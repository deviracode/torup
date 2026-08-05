import { groupBy } from "lodash-es";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";
import { AppError } from "../../middleware/error-handler";
import { cacheClear } from "../../lib/redis";
import { type createStaffRepo } from "./staff.repository";

type Repo = ReturnType<typeof createStaffRepo>;

interface BreakRow {
  id: string;
  specific_date: string;
  [key: string]: unknown;
}

interface ServiceRow {
  staff_id: string;
  service_id: string;
}

function groupIntoRanges(rows: Record<string, unknown>[]) {
  const sorted = [...rows].sort((a, b) =>
    String(a.specific_date).localeCompare(String(b.specific_date)),
  );
  const ranges: {
    id: string;
    start_date: string;
    end_date: string;
    break_ids: string[];
  }[] = [];
  for (const row of sorted) {
    const date = String(row.specific_date);
    const last = ranges[ranges.length - 1];
    if (last) {
      const prev = new Date(last.end_date + "T12:00:00Z");
      prev.setDate(prev.getDate() + 1);
      if (prev.toISOString().split("T")[0] === date) {
        last.end_date = date;
        last.break_ids.push(String(row.id));
        continue;
      }
    }
    ranges.push({
      id: String(row.id),
      start_date: date,
      end_date: date,
      break_ids: [String(row.id)],
    });
  }
  return ranges;
}

export function createStaffService(repo: Repo) {
  return {
    async list(supabase: SupabaseClient<Database>, businessId: string) {
      const { data, error } = await repo.findMembers(businessId);
      if (error) throw new AppError(500, error.message);
      if (!data || data.length === 0) return [];
      const memberIds = data.map((m) => m.id);
      const [users, svcs, breaks] = await Promise.all([
        Promise.all(
          data.map((m) => supabase.auth.admin.getUserById(m.user_id)),
        ),
        repo.findServicesAll(memberIds),
        repo.findTimeOffAll(memberIds),
      ]);
      const svcGrouped = groupBy(
        (svcs.data ?? []) as unknown as ServiceRow[],
        "staff_id",
      );
      const breakGrouped = groupBy(
        (breaks.data ?? []) as unknown as BreakRow[],
        "staff_id",
      );
      return data.map((m, i) => ({
        ...m,
        user: users[i].data?.user
          ? {
              email: users[i].data.user.email,
              user_metadata: users[i].data.user.user_metadata,
            }
          : undefined,
        service_ids: (svcGrouped[m.id] ?? []).map((s) => s.service_id),
        time_off_ranges: groupIntoRanges(breakGrouped[m.id] ?? []),
      }));
    },

    async add(
      supabase: SupabaseClient<Database>,
      businessId: string,
      body: { email: string; role?: string; display_name?: string },
    ) {
      if (!body.email) throw new AppError(400, "Email is required");
      const { data: users, error: lErr } =
        await supabase.auth.admin.listUsers();
      if (lErr) throw new AppError(500, lErr.message);
      const user = users.users.find((u) => u.email === body.email);
      if (!user) throw new AppError(404, "No user found with that email");
      const { data, error } = await repo.createMember({
        business_id: businessId,
        user_id: user.id,
        role: body.role || "staff",
        display_name:
          body.display_name || user.user_metadata?.name || body.email,
      });
      if (error) {
        if (error.code === "23505")
          throw new AppError(409, "This user is already a staff member");
        throw new AppError(400, error.message);
      }
      return data;
    },

    async edit(
      memberId: string,
      businessId: string,
      body: { display_name: string },
    ) {
      if (!body.display_name?.trim())
        throw new AppError(400, "display_name is required");
      const { data, error } = await repo.updateMember(
        memberId,
        businessId,
        { display_name: body.display_name.trim() },
      );
      if (error) throw new AppError(400, error.message);
      if (!data) throw new AppError(404, "Staff member not found");
      return data;
    },

    async remove(memberId: string, businessId: string) {
      const { error } = await repo.deleteMember(memberId, businessId);
      if (error) throw new AppError(400, error.message);
    },

    async getServices(memberId: string) {
      const { data, error } = await repo.findServiceIds(memberId);
      if (error) throw new AppError(500, error.message);
      return { service_ids: (data || []).map((r) => r.service_id) };
    },

    async setServices(
      businessId: string,
      memberId: string,
      serviceIds: string[],
    ) {
      const unique = [...new Set(serviceIds)];
      if (unique.length > 0) {
        const { data: svcs } = await repo.validateServiceIds(
          businessId,
          unique,
        );
        if (!svcs || svcs.length !== unique.length)
          throw new AppError(400, "Invalid service_ids");
      }
      await repo.replaceServices(memberId, unique);
      await cacheClear(`appts:${businessId}:*`);
      return { service_ids: unique };
    },

    async getTimeOff(memberId: string) {
      const { data, error } = await repo.findTimeOff(memberId);
      if (error) throw new AppError(500, error.message);
      return { ranges: groupIntoRanges(data || []) };
    },

    async addTimeOff(
      businessId: string,
      memberId: string,
      startDate: string,
      endDate: string,
    ) {
      if (endDate < startDate)
        throw new AppError(400, "end_date must be >= start_date");
      const diff =
        (new Date(endDate + "T12:00:00Z").getTime() -
          new Date(startDate + "T12:00:00Z").getTime()) /
        86400000;
      if (diff > 365)
        throw new AppError(400, "Range cannot exceed 365 days");
      const rows: Record<string, unknown>[] = [];
      const cur = new Date(startDate + "T12:00:00Z");
      const last = new Date(endDate + "T12:00:00Z");
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
      const { data, error } = await repo.insertTimeOff(rows);
      if (error) throw new AppError(400, error.message);
      await cacheClear(`appts:${businessId}:*`);
      return { inserted: data?.length ?? rows.length };
    },

    async removeTimeOff(
      businessId: string,
      memberId: string,
      breakIds: string[],
    ) {
      const { error } = await repo.deleteTimeOff(
        breakIds,
        memberId,
        businessId,
      );
      if (error) throw new AppError(400, error.message);
      await cacheClear(`appts:${businessId}:*`);
    },
  };
}
