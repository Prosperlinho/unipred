import { ArrowLeft, Globe, Info, Lock, ShieldAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { MarketCard } from "@/components/MarketCard";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { getOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import { getRequestTime } from "@/lib/time";
import type { Market, Room } from "@/lib/types";
import { DropQuestion, HostResolve, InviteBox, JoinLeaveButton } from "../RoomControls";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(props: PageProps<"/rooms/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return { title: "Room · UniPred" };
  const supabase = await createClient();
  const { data } = await supabase.from("rooms").select("name").eq("id", id).maybeSingle<{ name: string }>();
  return { title: data ? `${data.name} · UniPred room` : "Room · UniPred" };
}

export default async function RoomPage(props: PageProps<"/rooms/[id]">) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();
  const [viewer, settings, origin] = await Promise.all([getViewer(), getSettings(), getOrigin()]);
  const supabase = await createClient();
  const { data: room } = await supabase.from("rooms").select("*").eq("id", id).maybeSingle<Room>();
  if (!room) notFound();

  const [{ data: memberRows }, { data: marketRows }, { data: host }] = await Promise.all([
    supabase.from("room_members").select("user_id").eq("room_id", id),
    supabase.from("markets").select("*").eq("room_id", id).order("created_at", { ascending: false }).limit(60),
    supabase.from("public_profiles").select("username").eq("id", room.owner_id).maybeSingle<{ username: string }>(),
  ]);
  const members = (memberRows ?? []) as Array<{ user_id: string }>;
  const isMember = !!viewer && members.some((m) => m.user_id === viewer.id);
  const isHost = viewer?.id === room.owner_id;
  const now = getRequestTime();
  const markets = (marketRows ?? []) as Market[];
  const live = markets.filter((m) => m.status === "open" && new Date(m.closes_at).getTime() > now);
  const awaiting = markets.filter((m) => m.status === "open" && new Date(m.closes_at).getTime() <= now);
  const ended = markets.filter((m) => m.status !== "open");
  const hostName = host?.username ?? "the host";

  return (
    <Container narrow>
      <Link href="/rooms" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-white">
        <ArrowLeft className="size-4" /> Rooms
      </Link>

      <section className="rounded-3xl border border-line bg-linear-to-br from-brand/10 to-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-2xl font-black text-black">
            {room.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-white">{room.name}</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                {room.is_public ? <Globe className="size-3" /> : <Lock className="size-3" />}
                {room.is_public ? "Public" : "Private"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> {members.length} member{members.length === 1 ? "" : "s"}
              </span>
              <span>Host @{hostName}</span>
            </p>
            {room.description && <p className="mt-1.5 text-sm text-white/80">{room.description}</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {viewer ? (
            <JoinLeaveButton roomId={room.id} member={isMember} isHost={isHost} />
          ) : (
            <Link href={`/login?next=/rooms/${room.id}`} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-black">
              Log in to join
            </Link>
          )}
        </div>
        {(isMember || isHost) && (
          <div className="mt-3">
            <InviteBox link={`${origin}/rooms/join/${room.invite_code}`} code={room.invite_code} roomName={room.name} />
          </div>
        )}
      </section>

      {room.suspended && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-no/10 p-3 text-sm text-no">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" /> This room has been suspended by UniPred. Betting is closed.
        </p>
      )}
      <p className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-100">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-300" />
        Results in this room are decided by the host, @{hostName}, not by UniPred. Only stake with hosts you trust.
      </p>

      {isHost && !room.suspended && (
        <div className="mt-4">
          <DropQuestion roomId={room.id} />
        </div>
      )}

      {isHost && awaiting.length > 0 && (
        <section className="mt-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-300">Waiting for your result</h2>
          {awaiting.map((m) => (
            <article key={m.id} className="space-y-3 rounded-2xl border border-amber-400/30 bg-card p-4">
              <Link href={`/markets/${m.id}`} className="block font-semibold text-white hover:underline">
                {m.question}
              </Link>
              <HostResolve marketId={m.id} roomId={room.id} />
            </article>
          ))}
        </section>
      )}

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Live questions</h2>
        {live.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
            {isHost ? "Drop your first question above." : "No live questions right now."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {live.map((m) => (
              <MarketCard key={m.id} market={m} now={now} feeBps={settings.pool_fee_bps} />
            ))}
          </div>
        )}
      </section>

      {(ended.length > 0 || (!isHost && awaiting.length > 0)) && (
        <section className="mt-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Finished</h2>
          <div className="grid grid-cols-1 gap-3">
            {[...(isHost ? [] : awaiting), ...ended].map((m) => (
              <MarketCard key={m.id} market={m} now={now} feeBps={settings.pool_fee_bps} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
