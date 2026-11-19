import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { BannerPlacement, PlatformSettings, School, SponsorBanner } from "@/lib/types";

const DEFAULT_SETTINGS: PlatformSettings = {
  pool_fee_bps: 1000,
  min_trade_kobo: 10_000,
  min_deposit_kobo: 10_000,
  min_withdrawal_kobo: 100_000,
  referral_share_bps: 2000,
  terms_version: 1,
  exit_fee_bps: 1500,
  signup_bonus_kobo: 0,
};

export const getSchools = cache(async (): Promise<School[]> => {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("schools").select("*").order("name");
  return (data ?? []) as School[];
});

export const getSettings = cache(async (): Promise<PlatformSettings> => {
  if (!isSupabaseConfigured) return DEFAULT_SETTINGS;
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("pool_fee_bps, min_trade_kobo, min_deposit_kobo, min_withdrawal_kobo, referral_share_bps, terms_version, exit_fee_bps, signup_bonus_kobo")
    .eq("id", 1)
    .maybeSingle<PlatformSettings>();
  return data ?? DEFAULT_SETTINGS;
});

/** Schools UniPred is currently open at: used for pickers and the market feed. */
export const getActiveSchools = cache(async (): Promise<School[]> => {
  const all = await getSchools();
  return all.filter((s) => s.active !== false);
});

export function schoolMap(schools: School[]): Record<string, School> {
  return Object.fromEntries(schools.map((s) => [s.id, s]));
}

/** Converts Supabase/Postgres errors into a message safe to show users. */
export function friendlyError(message: string | undefined): string {
  if (!message) return "Something went wrong. Please try again.";
  if (message.includes("duplicate key") && message.includes("username")) return "That username is already taken.";
  if (message.includes("violates check constraint")) return "Some details are invalid. Please check and try again.";
  if (message.includes("JWT") || message.includes("not authenticated")) return "Your session expired. Please log in again.";
  if (/email rate limit|over_email_send_rate_limit|rate limit exceeded/i.test(message)) {
    return "We're getting a lot of sign-ups right now, so our confirmation emails are paused for a few minutes. Please try again shortly.";
  }
  return message;
}

/** Every live sponsor banner for a spot on the site (newest first, up to 10); they take turns in a carousel. */
export const getBanners = cache(async (placement: BannerPlacement): Promise<SponsorBanner[]> => {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("sponsor_banners")
    .select("*")
    .contains("placements", [placement])
    .order("created_at", { ascending: false })
    .limit(10);
  return Array.isArray(data) ? (data as SponsorBanner[]) : [];
});

/** Every live sponsor banner (any placement), newest first: used by the always-visible sponsor bar. */
export const getLiveBanners = cache(async (): Promise<SponsorBanner[]> => {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("sponsor_banners").select("*").order("created_at", { ascending: false }).limit(12);
  return Array.isArray(data) ? (data as SponsorBanner[]) : [];
});
