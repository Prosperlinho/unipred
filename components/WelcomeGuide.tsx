"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { finishOnboarding } from "@/app/actions/settings";
import { TourHost } from "./Tour";

/** Brand-new members get the walkthrough automatically; it's marked done when they finish or skip it. */
export function WelcomeGuide() {
  const router = useRouter();
  const finish = useCallback(() => {
    void finishOnboarding().then(() => router.refresh());
  }, [router]);
  return <TourHost autoStart onFinish={finish} />;
}
