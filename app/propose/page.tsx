import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { SUPPORT_EMAIL } from "@/components/LegalPage";
import { requireViewer } from "@/lib/auth";
import { getActiveSchools } from "@/lib/data";
import { ProposeForm } from "./ProposeForm";

export const metadata: Metadata = { title: "Propose a market · UniPred" };

export default async function ProposePage() {
  const viewer = await requireViewer("/propose");
  if (!viewer.profile.can_propose && !viewer.profile.is_admin) {
    return (
      <Container narrow>
        <div className="mx-auto max-w-md rounded-2xl border border-line bg-card p-6 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Lock className="size-6" />
          </span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Proposing is by invitation</h1>
          <p className="mt-2 text-sm text-muted">
            Only members approved by UniPred can create markets. Want access? Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Market%20proposer%20access%20(@${viewer.profile.username})`} className="text-brand underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <Link href="/markets" className="mt-5 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-black">
            Browse markets
          </Link>
        </div>
      </Container>
    );
  }
  const schools = await getActiveSchools();
  return (
    <Container narrow>
      <h1 className="font-serif text-2xl text-white sm:text-3xl">Propose a market</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        What&apos;s everyone arguing about on campus? Turn it into a market.
      </p>
      <ProposeForm
        schools={schools}
        defaultSchool={schools.some((sc) => sc.id === viewer.profile.school_id) ? viewer.profile.school_id : (schools[0]?.id ?? "")}
      />
    </Container>
  );
}
