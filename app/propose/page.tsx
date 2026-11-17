import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { requireViewer } from "@/lib/auth";
import { getActiveSchools } from "@/lib/data";
import { ProposeForm } from "./ProposeForm";

export const metadata: Metadata = { title: "Propose a market · UniPred" };

export default async function ProposePage() {
  const viewer = await requireViewer("/propose");
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
