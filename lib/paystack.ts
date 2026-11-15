import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const BASE = "https://api.paystack.co";

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
  meta?: { next?: string | null };
}

export class PaystackError extends Error {}

async function request<T>(path: string, init?: RequestInit & { revalidate?: number }): Promise<PaystackEnvelope<T>> {
  if (!env.paystackSecret) throw new PaystackError("Payments are not configured yet (PAYSTACK_SECRET_KEY missing).");
  const { revalidate, ...rest } = init ?? {};
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: { Authorization: `Bearer ${env.paystackSecret}`, "Content-Type": "application/json" },
    ...(revalidate ? { next: { revalidate } } : { cache: "no-store" }),
  });
  const json = (await res.json().catch(() => null)) as PaystackEnvelope<T> | null;
  if (!res.ok || !json?.status) throw new PaystackError(json?.message ?? `Paystack request failed (${res.status})`);
  return json;
}

export interface Bank {
  name: string;
  code: string;
}

export const paystack = {
  async initializeTransaction(input: {
    email: string;
    amount: number;
    reference: string;
    callback_url: string;
    metadata: Record<string, string>;
  }) {
    const res = await request<{ authorization_url: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({ ...input, currency: "NGN" }),
    });
    return res.data;
  },

  async verifyTransaction(reference: string) {
    const res = await request<{
      status: string;
      amount: number;
      reference: string;
      channel: string;
      authorization?: { account_name?: string | null; sender_name?: string | null } | null;
      customer?: { first_name?: string | null; last_name?: string | null } | null;
    }>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    return res.data;
  },

  /** Nigerian banks that support transfers. Cached for a day. */
  async listBanks(): Promise<Bank[]> {
    const banks: Bank[] = [];
    let cursor: string | null | undefined;
    for (let page = 0; page < 6; page++) {
      const qs = new URLSearchParams({ country: "nigeria", currency: "NGN", perPage: "100", use_cursor: "true" });
      if (cursor) qs.set("next", cursor);
      const res = await request<Array<Bank & { active: boolean; is_deleted: boolean | null }>>(`/bank?${qs}`, {
        revalidate: 86_400,
      });
      for (const b of res.data) if (b.active && !b.is_deleted) banks.push({ name: b.name, code: b.code });
      cursor = res.meta?.next;
      if (!cursor) break;
    }
    const seen = new Set<string>();
    return banks
      .filter((b) => (seen.has(b.code) ? false : (seen.add(b.code), true)))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async resolveAccount(accountNumber: string, bankCode: string) {
    const qs = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode });
    const res = await request<{ account_name: string; account_number: string }>(`/bank/resolve?${qs}`);
    return res.data;
  },

  async createRecipient(input: { name: string; account_number: string; bank_code: string }) {
    const res = await request<{ recipient_code: string }>("/transferrecipient", {
      method: "POST",
      body: JSON.stringify({ type: "nuban", currency: "NGN", ...input }),
    });
    return res.data;
  },

  async transfer(input: { amount: number; recipient: string; reference: string; reason: string }) {
    const res = await request<{ transfer_code: string; status: string }>("/transfer", {
      method: "POST",
      body: JSON.stringify({ source: "balance", ...input }),
    });
    return res.data;
  },
};

/** Validates the x-paystack-signature header on webhooks. */
export function isValidPaystackSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !env.paystackSecret) return false;
  const expected = createHmac("sha512", env.paystackSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
