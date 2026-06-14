import type { Request, Response, NextFunction } from "express";
import { createClient } from "@torup/db";
import { createServiceClient } from "../lib/supabase.js";
import { getPlanLimits, type PlanLimits } from "../lib/plan-limits.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: "super_admin" | "business_owner" | "staff";
  businessId?: string;
  planLimits?: PlanLimits | null;
}

/**
 * Middleware: Extract and validate Supabase JWT from Authorization header
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
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    req.userId = user.id;
    req.userEmail = user.email;

    // Check for super admin
    const isSuperAdmin = user.user_metadata?.role === "super_admin";

    // Find user's business membership (use service client to bypass RLS)
    const serviceClient = createServiceClient();
    const { data: membership } = await serviceClient
      .from("business_members")
      .select("business_id, role")
      .eq("user_id", user.id)
      .single();

    if (membership) {
      req.businessId = membership.business_id;
    }

    if (isSuperAdmin) {
      req.userRole = "super_admin";
    } else if (membership) {
      req.userRole =
        membership.role === "owner" ? "business_owner" : "staff";
    }

    next();
  } catch (err) {
    console.error("[auth middleware]", err);
    res.status(500).json({ error: "Authentication error" });
  }
}

/**
 * Middleware: Require specific role
 */
export function requireRole(...roles: Array<"super_admin" | "business_owner" | "staff">) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

/**
 * Middleware: Ensure user belongs to the business in the route params
 */
export function requireBusinessAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const businessId = req.params.businessId || req.params.id;

  if (req.userRole === "super_admin") {
    next();
    return;
  }

  if (!req.businessId || req.businessId !== businessId) {
    res.status(403).json({ error: "Access denied to this business" });
    return;
  }

  next();
}

/**
 * Middleware: Require an active subscription for the business.
 * Attaches planLimits to req for downstream enforcement.
 * Must be used after requireBusinessAccess.
 */
export async function requireSubscription(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Super admins bypass subscription checks
  if (req.userRole === "super_admin") { next(); return; }

  const businessId = req.params.businessId || req.params.id || req.businessId;
  if (!businessId) { next(); return; }

  try {
    const limits = await getPlanLimits(businessId);
    if (!limits) {
      res.status(403).json({ error: "no_active_subscription" });
      return;
    }
    req.planLimits = limits;
    next();
  } catch (err) {
    next(err);
  }
}
