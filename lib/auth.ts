import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface Viewer {
  id: string;
  email: string;
  profile: Profile;
  balanceKobo: number;
}

/** The signed-in user with profile and wallet, or null. Deduped per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: wallet }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
    supabase.from("wallets").select("balance_kobo").eq("user_id", user.id).maybeSingle<{ balance_kobo: number }>(),
  ]);
  if (!profile) return null;

  return { id: user.id, email: user.email ?? "", profile, balanceKobo: wallet?.balance_kobo ?? 0 };
});

export async function requireViewer(next: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer("/admin");
  if (!viewer.profile.is_admin) notFound();
  return viewer;
}
