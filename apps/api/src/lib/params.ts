import type { Request } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";
import type { AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";

/**
 * Extract businessId from route params (works with mergeParams)
 */
export function getBusinessId(req: Request): string {
  return (req.params as Record<string, string>).businessId;
}

export function getParam(req: Request, name: string): string {
  return (req.params as Record<string, string>)[name];
}

export function getUserClient(req: AuthenticatedRequest): SupabaseClient<Database> {
  if (!req.ctx?.userClient) {
    throw new AppError(500, "No request context (requireAuth must run first)");
  }
  return req.ctx.userClient;
}
