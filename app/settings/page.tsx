import type { Metadata } from "next";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { Container } from "@/components/Container";
import { PasswordForm } from "@/components/PasswordForm";
import { requireViewer } from "@/lib/auth";
import { getActiveSchools, getSchools } from "@/lib/data";
import { paystack, type Bank } from "@/lib/paystack";
import { createClient } from "@/lib/supabase/server";
import type { PayoutAccount } from "@/lib/types";
import { isValidFullName } from "@/lib/identity";
import { LeaderboardToggle, PayoutForm, ProfileForm, SetFullNameForm } from "./SettingsForms";

export const metadata: Metadata = { title: "Settings · UniPred" };

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-semibold text-white">{title}</h2>
      <p className="mb-4 text-xs text-muted">{subtitle}</p>
      {children}
    </section>
  );
}

async function loadBanks(): Promise<{ banks: Bank[]; error: string | null }> {
  try {
    return { banks: await paystack.listBanks(), error: null };
  } catch (e) {
    return { banks: [], error: e instanceof Error ? e.message : "Couldn't load the bank list." };
  }
}

export default async function SettingsPage() {
  const viewer = await requireViewer("/settings");
  const supabase = await createClient();

  const [allSchools, activeSchools, { data: account }, bankList] = await Promise.all([
    getSchools(),
    getActiveSchools(),
    supabase
      .from("payout_accounts")
      .select("bank_code, bank_name, account_number, account_name")
      .eq("user_id", viewer.id)
      .maybeSingle<PayoutAccount>(),
    loadBanks(),
  ]);

  return (
    <Container narrow>
      <h1 className="mb-1 text-xl font-extrabold tracking-tight text-white sm:text-2xl">Settings</h1>
      <p className="mb-6 text-sm text-muted">Signed in as {viewer.email}</p>

      <div className="space-y-4">
        <Section id="profile" title="Profile" subtitle="Your username shows on comments. Your school sets your default feed.">
          <ProfileForm
            profile={viewer.profile}
            schools={[
              ...activeSchools,
              ...allSchools.filter((sc) => sc.id === viewer.profile.school_id && sc.active === false),
            ]}
          />
        </Section>

        <Section id="payout" title="Payout bank account" subtitle="Where your withdrawals are sent. It must be in your own name.">
          {isValidFullName(viewer.profile.full_name ?? "") ? (
            <PayoutForm banks={bankList.banks} current={account ?? null} banksError={bankList.error} />
          ) : (
            <SetFullNameForm />
          )}
        </Section>

        <Section id="privacy" title="Leaderboard" subtitle="Choose whether your username and profit appear on the public leaderboard.">
          <LeaderboardToggle hidden={!!viewer.profile.leaderboard_hidden} />
        </Section>

        <Section id="password" title="Password" subtitle="Change the password you use to log in.">
          <PasswordForm />
        </Section>

        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-xl border border-line py-3 text-sm font-semibold text-muted transition hover:border-no/50 hover:text-no"
          >
            Log out
          </button>
        </form>
      </div>
    </Container>
  );
}
