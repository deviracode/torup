import { createClient as supabaseCreateClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

export function createClient(url?: string, key?: string) {
  const supabaseUrl = url || process.env.SUPABASE_URL;
  const supabaseKey = key || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return supabaseCreateClient<Database>(supabaseUrl, supabaseKey);
}
