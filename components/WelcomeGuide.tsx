"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { finishOnboarding } from "@/app/actions/settings";
import { GuideSheet, type GuideInfo } from "./Guide";

/** One-time guide for brand-new accounts. It stays available afterwards from the "?" button in the header. */
export function WelcomeGuide({ username, info }: { username: string; info: GuideInfo }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  const finish = useCallback(() => {
    setOpen(false);
    startTransition(async () => {
      await finishOnboarding();
      router.refresh();
    });
  }, [router]);

  if (!open) return null;
  return (
    <GuideSheet
      info={info}
      title={`Welcome, @${username}`}
      subtitle="Here's everything you need to know. You can open this guide again any time with the ? at the top."
      onClose={finish}
      closeLabel="Got it, let's go"
      closing={pending}
    />
  );
}
