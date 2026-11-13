import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/forms";
import { getViewer } from "@/lib/auth";
import { getSchools } from "@/lib/data";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Sign up · UniPred" };

export default async function SignupPage() {
  if (await getViewer()) redirect("/");
  const schools = await getSchools();
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  const maxDob = cutoff.toISOString().slice(0, 10);

  return (
    <AuthCard title="Join UniPred" subtitle="Predict what happens on your campus. Sign up with your email.">
      <SignupForm schools={schools} maxDob={maxDob} />
    </AuthCard>
  );
}
