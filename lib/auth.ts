import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export async function signInWithEmail(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();

  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signOut() {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signOut();
}

export async function getCurrentUser() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
}