"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { friendlyError } from "@/lib/data";
import { isValidFullName } from "@/lib/identity";
import { getOrigin, safeNext } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function isAdult(dob: string): boolean {
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return d <= cutoff;
}

export async function signUp(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  const username = str(fd, "username");
  const fullName = str(fd, "full_name");
  const schoolId = str(fd, "school_id");
  const dob = str(fd, "date_of_birth");
  const values = { email, username, full_name: fullName, school_id: schoolId, date_of_birth: dob };
  if (schoolId === "all") return { error: "Choose your own university.", values };
  const fail = (error: string): FormState => ({ error, values });

  if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");
  if (password.length < 8) return fail("Password must be at least 8 characters.");
  if (!USERNAME_RE.test(username)) return fail("Username must be 3-20 letters, numbers or underscores.");
  if (!isValidFullName(fullName)) return fail("Enter your full name (first and last) exactly as on your bank account.");
  if (!schoolId) return fail("Choose your university.");
  if (!isAdult(dob)) return fail("You must be at least 18 years old to use UniPred.");
  if (fd.get("terms") !== "on") return fail("Please confirm you are 18+ and accept the terms.");

  const supabase = await createClient();

  const { data: taken } = await supabase.from("public_profiles").select("id").ilike("username", username.replace(/_/g, "\\_")).limit(1);
  if (taken && taken.length > 0) return fail("That username is already taken.");

  const { data: school } = await supabase.from("schools").select("id").eq("id", schoolId).eq("active", true).maybeSingle();
  if (!school) return fail("Choose your university from the list.");

  const origin = await getOrigin();
  // Referral: set by proxy.ts when the visitor arrived through someone's ?ref= link.
  const ref = (await cookies()).get("unipred_ref")?.value;
  const validRef = ref && USERNAME_RE.test(ref) && ref.toLowerCase() !== username.toLowerCase() ? ref : undefined;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/`,
      data: {
        username,
        full_name: fullName,
        school_id: schoolId,
        date_of_birth: dob,
        ...(validRef ? { ref: validRef } : {}),
      },
    },
  });
  if (error) {
    if (error.message.toLowerCase().includes("database error")) {
      return fail("We couldn't create your account. That username may have just been taken.");
    }
    return fail(friendlyError(error.message));
  }

  if (data.session) redirect("/?welcome=1");
  return { message: `Almost there! We sent a confirmation link to ${email}. Open it to activate your account.` };
}

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "Please confirm your email first. Check your inbox (and spam) for the link." };
    }
    return { error: "Incorrect email or password." };
  }
  redirect(safeNext(fd.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const origin = await getOrigin();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm?next=/update-password` });
  return { message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  const confirm = typeof fd.get("confirm") === "string" ? (fd.get("confirm") as string) : "";
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendlyError(error.message) };
  return { message: "Password updated." };
}
