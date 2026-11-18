import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/forms";
import { getViewer } from "@/lib/auth";
import { getActiveSchools, getSettings } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Sign up · UniPred" };

export default async function SignupPage() {
  if (await getViewer()) redirect("/");
  const [schools, settings] = await Promise.all([getActiveSchools(), getSettings()]);
  const bonus = settings.signup_bonus_kobo > 0 ? formatNaira(settings.signup_bonus_kobo) : null;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  const maxDob = cutoff.toISOString().slice(0, 10);

  return (
    <AuthCard title="Join UniPred" subtitle={bonus ? `Sign up and get ${bonus} to play with.` : "Predict what happens on your campus."}>
      <SignupForm schools={schools} maxDob={maxDob} />
    </AuthCard>
  );
}
