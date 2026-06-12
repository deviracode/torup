import { Router, type Router as RouterType, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { getBusinessId, getParam } from "../lib/params.js";
import {
  requireAuth,
  requireRole,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { cacheClear } from "../lib/redis.js";

const router: RouterType = Router({ mergeParams: true });

function groupIntoRanges(rows: Record<string, unknown>[]) {
  const sorted = [...rows].sort((a, b) =>
    (a.specific_date as string).localeCompare(b.specific_date as string)
  );
  const ranges: { id: string; start_date: string; end_date: string; break_ids: string[] }[] = [];
  for (const row of sorted) {
    const date = row.specific_date as string;
    const last = ranges[ranges.length - 1];
    if (last) {
      const prevDate = new Date(last.end_date + "T12:00:00Z");
      prevDate.setDate(prevDate.getDate() + 1);
      const nextStr = prevDate.toISOString().split("T")[0];
      if (nextStr === date) {
        last.end_date = date;
        last.break_ids.push(row.id as string);
        continue;
      }
    }
    ranges.push({ id: row.id as string, start_date: date, end_date: date, break_ids: [row.id as string] });
  }
  return ranges;
}

// GET /businesses/:businessId/staff
router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);

      const { data, error } = await supabase
        .from("business_members")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at");

      if (error) throw new AppError(500, error.message);
      if (!data || data.length === 0) { res.json([]); return; }

      const memberIds = data.map((m: Record<string, unknown>) => m.id as string);

      const [userResults, ssResult, breaksResult] = await Promise.all([
        Promise.all(data.map((m: Record<string, unknown>) =>
          supabase.auth.admin.getUserById(m.user_id as string)
        )),
        supabase.from("staff_services").select("staff_id, service_id").in("staff_id", memberIds),
        supabase.from("breaks").select("*").in("staff_id", memberIds).eq("label", "time_off"),
      ]);

      const servicesByStaff = new Map<string, string[]>();
      for (const row of ssResult.data || []) {
        const r = row as { staff_id: string; service_id: string };
        if (!servicesByStaff.has(r.staff_id)) servicesByStaff.set(r.staff_id, []);
        servicesByStaff.get(r.staff_id)!.push(r.service_id);
      }

      const breaksByStaff = new Map<string, Record<string, unknown>[]>();
      for (const b of breaksResult.data || []) {
        const br = b as Record<string, unknown>;
        const sid = br.staff_id as string;
        if (!breaksByStaff.has(sid)) breaksByStaff.set(sid, []);
        breaksByStaff.get(sid)!.push(br);
      }

      const enriched = data.map((m: Record<string, unknown>, i: number) => {
        const authUser = userResults[i].data?.user;
        const staffId = m.id as string;
        return {
          ...m,
          user: authUser ? { email: authUser.email, user_metadata: authUser.user_metadata } : undefined,
          service_ids: servicesByStaff.get(staffId) || [],
          time_off_ranges: groupIntoRanges(breaksByStaff.get(staffId) || []),
        };
      });

      res.json(enriched);
    } catch (err) {
      next(err);
    }
  }
);

// POST /businesses/:businessId/staff
router.post(
  "/",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const { email, role, display_name } = req.body;

      if (!email) throw new AppError(400, "Email is required");

      const { data: users, error: lookupErr } = await supabase.auth.admin.listUsers();
      if (lookupErr) throw new AppError(500, lookupErr.message);

      const user = users.users.find((u) => u.email === email);
      if (!user) throw new AppError(404, "No user found with that email. They must sign up first.");

      const { data, error } = await supabase
        .from("business_members")
        .insert({
          business_id: businessId,
          user_id: user.id,
          role: role || "staff",
          display_name: display_name || user.user_metadata?.name || email,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new AppError(409, "This user is already a staff member");
        throw new AppError(400, error.message);
      }
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /businesses/:businessId/staff/:memberId
router.patch(
  "/:memberId",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const memberId = getParam(req, "memberId");
      const { display_name } = req.body;

      if (!display_name || !display_name.trim()) throw new AppError(400, "display_name is required");

      const { data, error } = await supabase
        .from("business_members")
        .update({ display_name: display_name.trim() })
        .eq("id", memberId)
        .eq("business_id", businessId)
        .select()
        .single();

      if (error) throw new AppError(400, error.message);
      if (!data) throw new AppError(404, "Staff member not found");

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /businesses/:businessId/staff/:memberId/services
router.get(
  "/:memberId/services",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const memberId = getParam(req, "memberId");

      const { data, error } = await supabase
        .from("staff_services")
        .select("service_id")
        .eq("staff_id", memberId);

      if (error) throw new AppError(500, error.message);
      res.json({ service_ids: (data || []).map((r: Record<string, unknown>) => r.service_id) });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /businesses/:businessId/staff/:memberId/services
router.put(
  "/:memberId/services",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const memberId = getParam(req, "memberId");
      const { service_ids } = req.body;

      if (!Array.isArray(service_ids)) throw new AppError(400, "service_ids must be an array");

      const unique = [...new Set(service_ids as string[])];

      if (unique.length > 0) {
        const { data: svcs } = await supabase
          .from("services")
          .select("id")
          .eq("business_id", businessId)
          .in("id", unique);
        if (!svcs || svcs.length !== unique.length) throw new AppError(400, "One or more service_ids are invalid");
      }

      await supabase.from("staff_services").delete().eq("staff_id", memberId);

      if (unique.length > 0) {
        const rows = unique.map((sid) => ({ staff_id: memberId, service_id: sid }));
        const { error: insErr } = await supabase.from("staff_services").insert(rows);
        if (insErr) throw new AppError(400, insErr.message);
      }

      await cacheClear(`appts:${businessId}:*`);
      res.json({ service_ids: unique });
    } catch (err) {
      next(err);
    }
  }
);

// GET /businesses/:businessId/staff/:memberId/time-off
router.get(
  "/:memberId/time-off",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const memberId = getParam(req, "memberId");

      const { data, error } = await supabase
        .from("breaks")
        .select("*")
        .eq("staff_id", memberId)
        .eq("label", "time_off")
        .order("specific_date");

      if (error) throw new AppError(500, error.message);

      const rows = data || [];
      const ranges: { id: string; start_date: string; end_date: string; break_ids: string[] }[] = [];
      for (const row of rows as Record<string, unknown>[]) {
        const date = row.specific_date as string;
        const last = ranges[ranges.length - 1];
        if (last) {
          const prevDate = new Date(last.end_date + "T12:00:00Z");
          prevDate.setDate(prevDate.getDate() + 1);
          const nextStr = prevDate.toISOString().split("T")[0];
          if (nextStr === date) {
            last.end_date = date;
            last.break_ids.push(row.id as string);
            continue;
          }
        }
        ranges.push({ id: row.id as string, start_date: date, end_date: date, break_ids: [row.id as string] });
      }

      res.json({ ranges });
    } catch (err) {
      next(err);
    }
  }
);

// POST /businesses/:businessId/staff/:memberId/time-off
router.post(
  "/:memberId/time-off",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const memberId = getParam(req, "memberId");
      const { start_date, end_date } = req.body;

      if (!start_date || !end_date) throw new AppError(400, "start_date and end_date are required");
      if (end_date < start_date) throw new AppError(400, "end_date must be >= start_date");

      const msPerDay = 86400000;
      const diffDays = (new Date(end_date + "T12:00:00Z").getTime() - new Date(start_date + "T12:00:00Z").getTime()) / msPerDay;
      if (diffDays > 365) throw new AppError(400, "Time-off range cannot exceed 365 days");

      const rows: Record<string, unknown>[] = [];
      const cur = new Date(start_date + "T12:00:00Z");
      const last = new Date(end_date + "T12:00:00Z");
      while (cur <= last) {
        rows.push({
          business_id: businessId,
          staff_id: memberId,
          type: "one_time",
          specific_date: cur.toISOString().split("T")[0],
          start_time: "00:00",
          end_time: "23:59",
          label: "time_off",
        });
        cur.setDate(cur.getDate() + 1);
      }

      const { data, error } = await supabase.from("breaks").insert(rows).select();
      if (error) throw new AppError(400, error.message);

      await cacheClear(`appts:${businessId}:*`);
      res.status(201).json({ inserted: data?.length ?? rows.length });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /businesses/:businessId/staff/:memberId/time-off
router.delete(
  "/:memberId/time-off",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const memberId = getParam(req, "memberId");
      const { break_ids } = req.body;

      if (!Array.isArray(break_ids) || break_ids.length === 0) throw new AppError(400, "break_ids must be a non-empty array");

      const { error } = await supabase
        .from("breaks")
        .delete()
        .in("id", break_ids as string[])
        .eq("staff_id", memberId)
        .eq("business_id", businessId);

      if (error) throw new AppError(400, error.message);

      await cacheClear(`appts:${businessId}:*`);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /businesses/:businessId/staff/:memberId
router.delete(
  "/:memberId",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("business_members")
        .delete()
        .eq("id", getParam(req, "memberId"))
        .eq("business_id", getBusinessId(req));

      if (error) throw new AppError(400, error.message);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
