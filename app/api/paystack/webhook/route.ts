import { NextResponse, type NextRequest } from "next/server";
import { isValidPaystackSignature } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";

interface PaystackEvent {
  event: string;
  data: {
    reference?: string;
    amount?: number;
    channel?: string;
    status?: string;
    reason?: string;
  };
}

/**
 * Paystack webhook: the source of truth for deposits and payouts.
 * Set the URL to https://<your-domain>/api/paystack/webhook in the Paystack dashboard.
 * Every handler is idempotent, so Paystack retries are safe.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!isValidPaystackSignature(raw, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let evt: PaystackEvent;
  try {
    evt = JSON.parse(raw) as PaystackEvent;
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const ref = evt.data.reference;

  switch (evt.event) {
    case "charge.success":
      if (ref?.startsWith("dep_") && typeof evt.data.amount === "number") {
        await admin.rpc("confirm_deposit", {
          p_reference: ref,
          p_amount_kobo: evt.data.amount,
          p_channel: evt.data.channel ?? "unknown",
        });
      }
      break;
    case "transfer.success":
      if (ref) await admin.rpc("complete_withdrawal", { p_id: ref });
      break;
    case "transfer.failed":
    case "transfer.reversed":
      if (ref) {
        await admin.rpc("fail_withdrawal", {
          p_id: ref,
          p_status: "failed",
          p_note: `Paystack: ${evt.data.reason ?? evt.event}`,
        });
      }
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
