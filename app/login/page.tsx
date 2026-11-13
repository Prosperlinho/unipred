import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/forms";
import { getViewer } from "@/lib/auth";
import { safeNext } from "@/lib/origin";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in · UniPred" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = safeNext(sp.next);
  if (await getViewer()) redirect(next);

  const notice =
    sp.confirmed === "1"
      ? "Email confirmed! Log in to continue."
      : sp.link === "invalid"
        ? "That link has expired or was already used. Log in, or request a new one."
        : undefined;

  return (
    <AuthCard title="Welcome back" subtitle="Log in to trade and manage your wallet.">
      <LoginForm next={next} notice={notice} />
    </AuthCard>
  );
}
