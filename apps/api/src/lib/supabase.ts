import { createClient as baseCreateClient } from "@queue/db";

// Service role client for admin operations
export function createServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return baseCreateClient(url, key);
}

// Anon client for public operations
export function createAnonClient() {
  return baseCreateClient();
}
