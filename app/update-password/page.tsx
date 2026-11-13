import type { Metadata } from "next";
import { AuthCard } from "@/components/forms";
import { PasswordForm } from "@/components/PasswordForm";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Set a new password · UniPred" };

export default async function UpdatePasswordPage() {
  await requireViewer("/update-password");
  return (
    <AuthCard title="Set a new password" subtitle="Choose a password you haven't used elsewhere.">
      <PasswordForm />
    </AuthCard>
  );
}
