import { ChevronRight, Globe, Lock, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Room } from "@/lib/types";
import { CreateRoomForm, JoinByCode } from "./RoomControls";

export const metadata: Metadata = {
  title: "Community rooms · UniPred",
  description: "Make a room for your friends, hostel or department and call it together.",
};

function RoomRow({ room, members, live, mine }: { room: Room; members: number; live: number; mine: boolean }) {
  return (
    <Link href={`/rooms/${room.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-card-2">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-lg font-black text-brand">
        {room.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-bold text-white">{room.name}</span>
          {room.is_public ? <Globe className="size-3.5 shrink-0 text-muted" /> : <Lock className="size-3.5 shrink-0 text-muted" />}
          {mine && <span className="shrink-0 rounded-full bg-brand/15 px-1.5 text-[10px] font-bold text-brand">HOST</span>}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" /> {members}
          </span>
          {live > 0 && <span className="font-semibold text-brand">{live} live</span>}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </Link>
  );
}

export default async function RoomsPage() {
  const viewer = await getViewer();
  const supabase = await createClient();
  const { data: roomData } = await supabase.from("rooms").select("*").eq("suspended", false).order("created_at", { ascending: false }).limit(100);
  const rooms = (roomData ?? []) as Room[];
  const ids = rooms.map((r) => r.id);
  const [{ data: memberRows }, { data: liveRows }] = await Promise.all([
    ids.length ? supabase.from("room_members").select("room_id, user_id").in("room_id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("markets").select("room_id").in("room_id", ids).eq("status", "open").gt("closes_at", new Date().toISOString())
      : Promise.resolve({ data: [] }),
  ]);
  const count = new Map<string, number>();
  const mineSet = new Set<string>();
  for (const m of (memberRows ?? []) as Array<{ room_id: string; user_id: string }>) {
    count.set(m.room_id, (count.get(m.room_id) ?? 0) + 1);
    if (viewer && m.user_id === viewer.id) mineSet.add(m.room_id);
  }
  const live = new Map<string, number>();
  for (const m of (liveRows ?? []) as Array<{ room_id: string }>) live.set(m.room_id, (live.get(m.room_id) ?? 0) + 1);

  const myRooms = rooms.filter((r) => mineSet.has(r.id));
  const discover = rooms
    .filter((r) => r.is_public && !mineSet.has(r.id))
    .sort((a, b) => (live.get(b.id) ?? 0) - (live.get(a.id) ?? 0) || (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0));

  return (
    <Container narrow>
      <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Community rooms</h1>
      <p className="mb-4 text-sm text-muted">Your crew, your questions. The host drops them, you call YES or NO.</p>

      {viewer ? (
        <div className="space-y-3">
          <CreateRoomForm />
          <JoinByCode />
        </div>
      ) : (
        <Link href="/login?next=/rooms" className="block rounded-2xl bg-brand py-3 text-center font-bold text-black">
          Log in to create or join rooms
        </Link>
      )}

      {myRooms.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Your rooms</h2>
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {myRooms.map((r) => (
              <RoomRow key={r.id} room={r} members={count.get(r.id) ?? 0} live={live.get(r.id) ?? 0} mine={r.owner_id === viewer?.id} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Discover public rooms</h2>
        {discover.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">No public rooms yet. Start one!</p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {discover.map((r) => (
              <RoomRow key={r.id} room={r} members={count.get(r.id) ?? 0} live={live.get(r.id) ?? 0} mine={false} />
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}
