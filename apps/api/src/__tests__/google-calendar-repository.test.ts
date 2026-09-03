import { describe, it, expect, vi } from "vitest";
import { createGcalRepo } from "../modules/google-calendar/google-calendar.repository";

function makeClient() {
  const gte = vi.fn().mockReturnThis();
  const lte = vi.fn().mockReturnThis();
  const order = vi.fn().mockResolvedValue({ data: [], error: null });
  const eq = vi.fn().mockReturnValue({ gte, lte, order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as any, gte, lte };
}

describe("google-calendar repository findEvents — DST-aware offset", () => {
  it("uses +03:00 (IDT) for a summer date", async () => {
    const { client, gte, lte } = makeClient();
    const repo = createGcalRepo(client);
    await repo.findEvents("biz-1", "2026-07-15");
    expect(gte).toHaveBeenCalledWith("start_time", "2026-07-15T00:00:00+03:00");
    expect(lte).toHaveBeenCalledWith("start_time", "2026-07-15T23:59:59+03:00");
  });

  it("uses +02:00 (IST) for a winter date, not a hardcoded +03:00", async () => {
    const { client, gte, lte } = makeClient();
    const repo = createGcalRepo(client);
    await repo.findEvents("biz-1", "2026-12-15");
    expect(gte).toHaveBeenCalledWith("start_time", "2026-12-15T00:00:00+02:00");
    expect(lte).toHaveBeenCalledWith("start_time", "2026-12-15T23:59:59+02:00");
  });
});
