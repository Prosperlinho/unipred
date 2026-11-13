import "server-only";
import { cache } from "react";

/** One timestamp per request, shared by every component that renders it. */
export const getRequestTime = cache((): number => Date.now());
