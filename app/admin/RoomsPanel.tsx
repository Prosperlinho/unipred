"use client";

import { Globe, Lock } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { setRoomSuspended } from "@/app/actions/rooms";
import { useUI } from "@/context/UIContext";

export interface AdminRoom {
  id: string;
  name: string;
  host: string;
  isPublic: boolean;
  suspended: boolean;
  members: number;
}

/** UniPred admins can suspend a room (no new questions or trades; hidden from the public). */
export function RoomsPanel({ rooms }: { rooms: AdminRoom[] }) {
  const { toast } = useUI();
  const [pending, startTransition] = useTransition();
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
      {rooms.map((r) => (
        <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
          {r.isPublic ? <Globe className="size-4 shrink-0 text-muted" /> : <Lock className="size-4 shrink-0 text-muted" />}
          <Link href={`/rooms/${r.id}`} className="min-w-0 flex-1">
            <span className={`block truncate font-semibold ${r.suspended ? "text-no line-through" : "text-white"}`}>{r.name}</span>
            <span className="text-xs text-muted">
              @{r.host} · {r.members} members
            </span>
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              (r.suspended || confirm(`Suspend "${r.name}"? Its questions stop taking trades.`)) &&
              startTransition(async () => {
                const res = await setRoomSuspended(r.id, !r.suspended);
                toast(res.ok ? (r.suspended ? "Room restored." : "Room suspended.") : res.error, res.ok ? "success" : "error");
              })
            }
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
              r.suspended ? "border border-line text-white" : "bg-no/15 text-no"
            }`}
          >
            {r.suspended ? "Restore" : "Suspend"}
          </button>
        </li>
      ))}
    </ul>
  );
}
