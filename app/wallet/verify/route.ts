import { NextResponse, type NextRequest } from "next/server";
import { checkDepositPayer } from "@/lib/depositCheck";
import { paystack } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";

/** Paystack redirects here after checkout. Verify server-side, then credit the wallet once. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");
  const back = (status: string) => NextResponse.redirect(new URL(`/wallet?deposit=${status}`, origin));
  if (!reference) return back("failed");

  try {
    const tx = await paystack.verifyTransaction(reference);
    if (tx.status !== "success") return back(tx.status === "abandoned" ? "cancelled" : "failed");
    const admin = createAdminClient();
    const { error } = await admin.rpc("confirm_deposit", {
      p_reference: reference,
      p_amount_kobo: tx.amount,
      p_channel: tx.channel,
    });
    if (error) return back("failed");
    await checkDepositPayer(reference, tx).catch(() => undefined);
    return back("success");
  } catch {
    return back("failed");
  }
}
