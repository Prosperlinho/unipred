import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import { getViewer } from "@/lib/auth";
import { friendlyError } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Invite links: /rooms/join/ABCD1234 joins the room and opens it. */
export default async function JoinRoomPage(props: PageProps<"/rooms/join/[code]">) {
  const { code } = await props.params;
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (!(await getViewer())) redirect(`/login?next=${encodeURIComponent(`/rooms/join/${clean}`)}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_room", { p_room: null, p_code: clean });
  if (!error && data) redirect(`/rooms/${data as string}`);
  return (
    <Container narrow>
      <div className="mx-auto max-w-sm rounded-2xl border border-line bg-card p-6 text-center">
        <p className="font-bold text-white">Couldn&apos;t join this room</p>
        <p className="mt-1 text-sm text-muted">{friendlyError(error?.message)}</p>
      </div>
    </Container>
  );
}
