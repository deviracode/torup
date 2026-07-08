import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserClient } from "@torup/db";
import type { Database } from "@torup/db";

export interface RequestContext {
  userId: string;
  userEmail?: string;
  role: "super_admin" | "business_owner" | "staff";
  memberships: Array<{ businessId: string; role: "owner" | "staff" }>;
  userClient: SupabaseClient<Database>;
}

export function buildRequestContext(
  accessToken: string,
  user: { id: string; email?: string; isSuperAdmin: boolean },
  memberships: Array<{ businessId: string; role: "owner" | "staff" }>
): RequestContext {
  let role: RequestContext["role"];
  if (user.isSuperAdmin) {
    role = "super_admin";
  } else if (memberships.some((m) => m.role === "owner")) {
    role = "business_owner";
  } else {
    role = "staff";
  }

  return {
    userId: user.id,
    userEmail: user.email,
    role,
    memberships,
    userClient: createUserClient(accessToken),
  };
}
