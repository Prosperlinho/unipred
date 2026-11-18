"use client";

import { ArrowDownToLine, ArrowUpFromLine, Landmark, Send, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { P2PStatus } from "@/app/actions/wallet";
import type { PayoutAccount } from "@/lib/types";
import { SendMoneyForm } from "./SendMoneyForm";
import { DepositForm, WithdrawForm } from "./WalletForms";

type Action = "deposit" | "withdraw" | "send";

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/75" />
      <div className="relative max-h-[90dvh] w-full animate-sheet-up overflow-y-auto rounded-t-3xl border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:animate-pop-in sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-card hover:text-white" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Round quick-action buttons under the balance; each opens a sheet. */
export function WalletActions({
  minDepositKobo,
  minWithdrawalKobo,
  balanceKobo,
  account,
  p2p,
  testModeNote,
  initial,
}: {
  minDepositKobo: number;
  minWithdrawalKobo: number;
  balanceKobo: number;
  account: PayoutAccount | null;
  p2p: P2PStatus | null;
  testModeNote: ReactNode;
  initial?: Action | null;
}) {
  const [open, setOpen] = useState<Action | null>(initial ?? null);
  const close = () => setOpen(null);

  const buttons: Array<{ id: Action | "bank"; label: string; Icon: LucideIcon; primary?: boolean }> = [
    { id: "deposit", label: "Add money", Icon: ArrowDownToLine, primary: true },
    { id: "withdraw", label: "Withdraw", Icon: ArrowUpFromLine },
    { id: "send", label: "Send", Icon: Send },
    { id: "bank", label: "Bank", Icon: Landmark },
  ];

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {buttons.map(({ id, label, Icon, primary }) => {
          const inner = (
            <>
              <span
                className={`flex size-12 items-center justify-center rounded-full transition group-active:scale-95 ${
                  primary ? "bg-brand text-black" : "bg-card-2 text-white group-hover:bg-line"
                }`}
              >
                <Icon className="size-5" strokeWidth={2.4} />
              </span>
              <span className="text-xs font-medium text-white/80">{label}</span>
            </>
          );
          return id === "bank" ? (
            <Link key={id} href="/settings#payout" className="group flex flex-col items-center gap-1.5">
              {inner}
            </Link>
          ) : (
            <button key={id} type="button" onClick={() => setOpen(id)} className="group flex flex-col items-center gap-1.5">
              {inner}
            </button>
          );
        })}
      </div>

      {open === "deposit" && (
        <Sheet title="Add money" onClose={close}>
          <div className="space-y-3">
            <DepositForm minKobo={minDepositKobo} />
            {testModeNote}
          </div>
        </Sheet>
      )}
      {open === "withdraw" && (
        <Sheet title="Withdraw" onClose={close}>
          <WithdrawForm minKobo={minWithdrawalKobo} balanceKobo={balanceKobo} account={account} />
        </Sheet>
      )}
      {open === "send" && (
        <Sheet title="Send to a member" onClose={close}>
          <SendMoneyForm status={p2p} />
        </Sheet>
      )}
    </>
  );
}
