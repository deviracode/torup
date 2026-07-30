import { AppError } from "../../middleware/error-handler";
import { type createServiceRepo } from "./services.repository";

type Repo = ReturnType<typeof createServiceRepo>;

const COLORS = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316","#eab308","#22c55e","#14b8a6","#06b6d4","#3b82f6"];

export function createServiceService(repo: Repo) {
  return {
    async list(businessId: string) {
      const [svcRes, catRes] = await Promise.all([repo.findAll(businessId), repo.findCategories(businessId)]);
      if (svcRes.error) throw new AppError(500, svcRes.error.message);
      const cats = catRes.data || [], svcs = svcRes.data || [];
      return cats.length === 0 ? svcs : { categories: cats, services: svcs };
    },
    async add(businessId: string, body: Record<string, unknown>) {
      const color = body.color ?? COLORS[Math.floor(Math.random() * COLORS.length)];
      if (typeof color !== "string" || !/^#([A-Fa-f0-9]{6})$/.test(color)) throw new AppError(400, "Invalid color format");
      const { data, error } = await repo.create({ ...body, color, business_id: businessId });
      if (error) throw new AppError(400, error.message);
      return data;
    },
    async edit(serviceId: string, businessId: string, body: Record<string, unknown>) {
      if (body.color != null && (typeof body.color !== "string" || !/^#([A-Fa-f0-9]{6})$/.test(body.color))) throw new AppError(400, "Invalid color format");
      const { data, error } = await repo.update(serviceId, businessId, body);
      if (error) throw new AppError(400, error.message);
      return data?.[0] ?? {};
    },
    async remove(serviceId: string, businessId: string) { const { error } = await repo.softDelete(serviceId, businessId); if (error) throw new AppError(400, error.message); },
  };
}
