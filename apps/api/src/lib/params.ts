import type { Request } from "express";

/**
 * Extract businessId from route params (works with mergeParams)
 */
export function getBusinessId(req: Request): string {
  return (req.params as Record<string, string>).businessId;
}

export function getParam(req: Request, name: string): string {
  return (req.params as Record<string, string>)[name];
}
