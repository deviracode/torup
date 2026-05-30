import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Bypass auth for these route-level tests.
vi.mock("../middleware/auth.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireBusinessAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Stub WhatsApp + notification dispatch (fire-and-forget, irrelevant to assertions).
vi.mock("../services/whatsapp.js", () => ({
  sendInteractiveReminder: vi.fn(async () => null),
  sendWhatsAppMessage: vi.fn(async () => null),
}));

// In-memory appointment store keyed by id.
const TARGET_ID = "00000000-0000-0000-0000-000000000001";
const OVERLAP_ID = "00000000-0000-0000-0000-000000000002";
const NON_OVERLAP_ID = "00000000-0000-0000-0000-000000000003";
const BUSINESS_ID = "biz-1";

type Apt = { id: string; business_id: string; status: string; start_time: string; end_time: string };

let store: Record<string, Apt>;

function freshStore() {
  return {
    [TARGET_ID]: {
      id: TARGET_ID,
      business_id: BUSINESS_ID,
      status: "pending_approval",
      start_time: "2099-01-01T10:00:00Z",
      end_time: "2099-01-01T10:30:00Z",
    },
    [OVERLAP_ID]: {
      id: OVERLAP_ID,
      business_id: BUSINESS_ID,
      status: "pending_approval",
      start_time: "2099-01-01T10:15:00Z",
      end_time: "2099-01-01T10:45:00Z",
    },
    [NON_OVERLAP_ID]: {
      id: NON_OVERLAP_ID,
      business_id: BUSINESS_ID,
      status: "pending_approval",
      start_time: "2099-01-01T11:30:00Z",
      end_time: "2099-01-01T12:00:00Z",
    },
  };
}

// Tiny chainable stub of the supabase JS client surface used by the approve/reject handlers.
function makeSupabaseStub() {
  return {
    from(table: string) {
      if (table !== "appointments") {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) };
      }

      // chain state
      const filters: { field: string; op: string; value: unknown }[] = [];
      const builder: Record<string, unknown> = {};

      const apply = (): Apt[] => {
        return Object.values(store).filter((a) => {
          for (const f of filters) {
            const v = (a as Record<string, unknown>)[f.field];
            if (f.op === "eq" && v !== f.value) return false;
            if (f.op === "neq" && v === f.value) return false;
            if (f.op === "lt" && !(typeof v === "string" && v < (f.value as string))) return false;
            if (f.op === "gt" && !(typeof v === "string" && v > (f.value as string))) return false;
          }
          return true;
        });
      };

      builder.select = () => builder;
      builder.eq = (field: string, value: unknown) => {
        filters.push({ field, op: "eq", value });
        return builder;
      };
      builder.neq = (field: string, value: unknown) => {
        filters.push({ field, op: "neq", value });
        return builder;
      };
      builder.lt = (field: string, value: unknown) => {
        filters.push({ field, op: "lt", value });
        return builder;
      };
      builder.gt = (field: string, value: unknown) => {
        filters.push({ field, op: "gt", value });
        return builder;
      };
      builder.in = (field: string, values: unknown[]) => {
        filters.push({ field, op: "eq", value: values[0] }); // simplified
        return builder;
      };
      builder.single = async () => {
        const rows = apply();
        return { data: rows[0] || null, error: rows[0] ? null : { message: "not found" } };
      };
      // Make the select chain awaitable: `await supabase.from(..).select().eq(..)` returns { data, error }.
      builder.then = (resolve: (v: { data: Apt[]; error: null }) => void) => {
        resolve({ data: apply(), error: null });
      };

      // For .update().eq()/.in() chains we need to capture the patch then apply on terminal call.
      const original = { ...builder };
      builder.update = (patch: Record<string, unknown>) => {
        const updFilters: { field: string; op: string; value: unknown; values?: unknown[] }[] = [];
        const updBuilder: Record<string, unknown> = {
          eq(field: string, value: unknown) {
            updFilters.push({ field, op: "eq", value });
            return updBuilder;
          },
          in(field: string, values: unknown[]) {
            updFilters.push({ field, op: "in", value: null, values });
            return updBuilder;
          },
          then(resolve: (v: { error: null }) => void) {
            for (const a of Object.values(store)) {
              const ok = updFilters.every((f) => {
                if (f.op === "eq") return (a as Record<string, unknown>)[f.field] === f.value;
                if (f.op === "in") return f.values?.includes((a as Record<string, unknown>)[f.field]);
                return true;
              });
              if (ok) Object.assign(a, patch);
            }
            resolve({ error: null });
            return Promise.resolve({ error: null });
          },
        };
        // Reset filter list on builder so subsequent select chain doesn't get polluted
        filters.length = 0;
        Object.assign(builder, original);
        return updBuilder;
      };

      return builder;
    },
  };
}

vi.mock("../lib/supabase.js", () => ({
  createServiceClient: () => makeSupabaseStub(),
}));

describe("POST /appointments/:id/approve and /reject", () => {
  beforeEach(() => {
    store = freshStore();
  });

  async function buildApp() {
    const router = (await import("../routes/appointments.js")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/businesses/:businessId/appointments", (req, _res, next) => {
      (req as unknown as { params: Record<string, string> }).params.businessId = BUSINESS_ID;
      next();
    }, router);
    return app;
  }

  it("approves target and cancels overlapping pending applicants", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post(`/api/businesses/${BUSINESS_ID}/appointments/${TARGET_ID}/approve`);

    expect(res.status).toBe(200);
    expect(store[TARGET_ID].status).toBe("confirmed");
    expect(store[OVERLAP_ID].status).toBe("cancelled");
    expect(store[NON_OVERLAP_ID].status).toBe("pending_approval");
    expect(res.body.approved).toBe(TARGET_ID);
    expect(res.body.rejected).toContain(OVERLAP_ID);
    expect(res.body.rejected).not.toContain(NON_OVERLAP_ID);
  });

  it("reject cancels only the target and leaves siblings alone", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post(`/api/businesses/${BUSINESS_ID}/appointments/${OVERLAP_ID}/reject`);

    expect(res.status).toBe(200);
    expect(store[OVERLAP_ID].status).toBe("cancelled");
    expect(store[TARGET_ID].status).toBe("pending_approval");
    expect(store[NON_OVERLAP_ID].status).toBe("pending_approval");
  });

  it("returns 409 when approving an already-confirmed appointment", async () => {
    store[TARGET_ID].status = "confirmed";
    const app = await buildApp();
    const res = await request(app)
      .post(`/api/businesses/${BUSINESS_ID}/appointments/${TARGET_ID}/approve`);

    expect(res.status).toBe(409);
  });
});
