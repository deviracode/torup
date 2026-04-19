import { Router, type Router as RouterType, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { getBusinessId } from "../lib/params.js";
import {
  requireAuth,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";

const router: RouterType = Router({ mergeParams: true });

// GET /businesses/:businessId/analytics
router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const { period } = req.query;

      const daysBack = period === "week" ? 7 : period === "year" ? 365 : 30;
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

      const [appointmentsResult, noShowResult, servicesResult] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, status, start_time, service_id, created_via", { count: "exact" })
          .eq("business_id", businessId)
          .gte("start_time", since),
        supabase
          .from("appointments")
          .select("id", { count: "exact" })
          .eq("business_id", businessId)
          .eq("status", "no_show")
          .gte("start_time", since),
        supabase
          .from("services")
          .select("id, name_he, price")
          .eq("business_id", businessId)
          .eq("is_active", true),
      ]);

      const appointments = appointmentsResult.data || [];
      const completedCount = appointments.filter(
        (a: Record<string, unknown>) => a.status === "completed"
      ).length;

      const revenue = appointments
        .filter((a: Record<string, unknown>) => a.status === "completed")
        .reduce((sum: number, a: Record<string, unknown>) => {
          const svc = (servicesResult.data || []).find(
            (s: Record<string, unknown>) => s.id === a.service_id
          );
          return sum + (svc?.price || 0);
        }, 0);

      // Busiest hours
      const hourCounts: Record<number, number> = {};
      for (const apt of appointments) {
        const hour = new Date(apt.start_time as string).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }

      res.json({
        period: `${daysBack} days`,
        total_appointments: appointmentsResult.count || 0,
        completed_appointments: completedCount,
        no_show_count: noShowResult.count || 0,
        no_show_rate:
          appointmentsResult.count
            ? ((noShowResult.count || 0) / appointmentsResult.count * 100).toFixed(1) + "%"
            : "0%",
        estimated_revenue: revenue,
        busiest_hours: Object.entries(hourCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([hour, count]) => ({ hour: parseInt(hour), count })),
        booking_sources: {
          whatsapp: appointments.filter((a: Record<string, unknown>) => a.created_via === "whatsapp").length,
          web: appointments.filter((a: Record<string, unknown>) => a.created_via === "web").length,
          manual: appointments.filter((a: Record<string, unknown>) => a.created_via === "manual").length,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
