import type { Request, Response, NextFunction } from "express";
import { createClient } from "@torup/db";
import { createServiceClient } from "../lib/supabase.js";
import { buildRequestContext, type RequestContext } from "../lib/request-context.js";

export interface AuthenticatedRequest extends Request {
  ctx?: RequestContext;
  // Back-compat fields (kept until all routes read ctx)
  userId?: string;
  userEmail?: string;
  userRole?: "super_admin" | "business_owner" | "staff";
  businessId?: string;
}

/**
 * Middleware: Extract and validate Supabase JWT from Authorization header.
 * Fetches ALL memberships and attaches a RequestContext to req.ctx.
 * Also mirrors back-compat fields (userId, userEmail, userRole, businessId).
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }
  const token = authHeader.substring(7);

  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const isSuperAdmin = user.user_metadata?.role === "super_admin";

    // Fetch ALL memberships (fixes the .single() crash for 0/many rows)
    const serviceClient = createServiceClient();
    const { data: membershipRows, error: membershipError } = await serviceClient
      .from("business_members")
      .select("business_id, role")
      .eq("user_id", user.id);
    if (membershipError) {
      console.error("[auth middleware] membership fetch failed:", membershipError);
    }

    const memberships = (membershipRows ?? []).map((m) => ({
      businessId: m.business_id as string,
      role: m.role as "owner" | "staff",
    }));

    const ctx = buildRequestContext(
      token,
      { id: user.id, email: user.email, isSuperAdmin },
      memberships
    );
    req.ctx = ctx;

    // Back-compat mirror
    req.userId = ctx.userId;
    req.userEmail = ctx.userEmail;
    req.userRole = ctx.role;
    req.businessId = memberships[0]?.businessId;

    next();
  } catch (err) {
    console.error("[auth middleware]", err);
    res.status(500).json({ error: "Authentication error" });
  }
}

/**
 * Middleware: Require specific role (reads from req.ctx)
 */
export function requireRole(...roles: Array<"super_admin" | "business_owner" | "staff">) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.ctx || !roles.includes(req.ctx.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

/**
 * Middleware: Ensure user belongs to the business in the route params.
 * Checks req.ctx.memberships; super_admin always passes.
 */
export function requireBusinessAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const businessId = req.params.businessId || req.params.id;

  if (req.ctx?.role === "super_admin") {
    next();
    return;
  }

  const isMember = req.ctx?.memberships.some((m) => m.businessId === businessId);
  if (!isMember) {
    res.status(403).json({ error: "Access denied to this business" });
    return;
  }
  next();
}
