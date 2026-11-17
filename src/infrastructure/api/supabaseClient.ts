import "expo-sqlite/localStorage/install";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client === null) {
    client = createSupabase();
  }
  return client;
}

function createSupabase(): SupabaseClient {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) {
    throw new Error("Brakuje EXPO_PUBLIC_SUPABASE_URL w pliku .env");
  }
  if (!key) {
    throw new Error("Brakuje EXPO_PUBLIC_SUPABASE_ANON_KEY w pliku .env");
  }
  return createClient(url, key, {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
