import { createClient as supabaseCreateClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createClient(url?: string, key?: string) {
  const supabaseUrl = url || process.env.SUPABASE_URL;
  const supabaseKey = key || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return supabaseCreateClient<Database>(supabaseUrl, supabaseKey);
}

export function createUserClient(accessToken: string): SupabaseClient<Database> {
  if (!accessToken) {
    throw new Error("createUserClient requires a non-empty access token");
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return supabaseCreateClient<Database>(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
