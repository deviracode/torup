import { type createAnalyticsRepo } from "./analytics.repository";

type Repo = ReturnType<typeof createAnalyticsRepo>;

export function createAnalyticsService(repo: Repo) {
  return {
    async get(businessId: string, period: string = "month") {
      const daysBack = period === "week" ? 7 : period === "year" ? 365 : 30;
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

      const [aptRes, noShowRes, svcRes] = await Promise.all([
        repo.findAppointments(businessId, since),
        repo.findNoShows(businessId, since),
        repo.findServices(businessId),
      ]);

      const appointments = (aptRes.data || []) as Record<string, any>[];
      const services = (svcRes.data || []) as Record<string, any>[];
      const completed = appointments.filter((a) => a.status === "completed").length;
      const revenue = appointments
        .filter((a) => a.status === "completed")
        .reduce((s, a) => s + (services.find((sv) => sv.id === a.service_id)?.price || 0), 0);

      const hourCounts: Record<number, number> = {};
      for (const a of appointments) {
        const h = new Date(a.start_time as string).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }

      return {
        period: `${daysBack} days`,
        total_appointments: aptRes.count || 0,
        completed_appointments: completed,
        no_show_count: noShowRes.count || 0,
        no_show_rate: aptRes.count
          ? (((noShowRes.count || 0) / aptRes.count) * 100).toFixed(1) + "%"
          : "0%",
        estimated_revenue: revenue,
        busiest_hours: Object.entries(hourCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([hour, count]) => ({ hour: parseInt(hour), count })),
        booking_sources: {
          whatsapp: appointments.filter((a) => a.created_via === "whatsapp").length,
          web: appointments.filter((a) => a.created_via === "web").length,
          manual: appointments.filter((a) => a.created_via === "manual").length,
        },
      };
    },
  };
}
