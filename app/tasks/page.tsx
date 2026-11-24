import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StreakCard, TaskList, type RewardStatus } from "./TasksClient";

export const metadata: Metadata = { title: "Tasks & Streak · UniPred" };

export default async function TasksPage() {
  await requireViewer("/tasks");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reward_status");
  const status = !error && data ? (data as RewardStatus) : null;

  return (
    <Container>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Tasks &amp; Streak</h1>
          <p className="mt-1 text-sm text-muted">Trade every day to grow your streak, and complete tasks to earn naira straight into your wallet.</p>
        </header>
        {status ? (
          <>
            <StreakCard status={status} />
            <TaskList tasks={status.tasks} />
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Tasks couldn&apos;t load right now. Refresh the page to try again.
          </p>
        )}
      </div>
    </Container>
  );
}
