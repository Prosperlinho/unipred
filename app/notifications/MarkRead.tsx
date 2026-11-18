"use client";

import { useEffect } from "react";
import { markAllRead } from "@/app/actions/notifications";

/** Opening the inbox marks everything as read (the dots stay until the next visit). */
export function MarkRead() {
  useEffect(() => {
    void markAllRead();
  }, []);
  return null;
}
