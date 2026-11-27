import Link from "next/link";
import type { ReactNode } from "react";

interface Props {
  feePct: number;
  exitFeePct: number;
  referralPct: number;
  /** Compact version for the acceptance popup. */
  compact?: boolean;
}

/** The single source of UniPred's house rules: used on /rules and in the must-accept popup. */
export function HouseRules({ feePct, exitFeePct, referralPct, compact = false }: Props) {
  const sections: Array<{ title: string; items: ReactNode[] }> = [
    {
      title: "How trading works",
      items: [
        <>
          UniPred uses <b>pool trading</b>. Every trade on a market goes into its YES pot or NO pot. UniPred never trades
          against you.
        </>,
        <>
          When the result is confirmed, everyone who backed the winning side gets <b>their stake back plus a share of the
          losing pot</b>, in proportion to how much they traded.
        </>,
        <>
          UniPred keeps <b>{feePct}% of those winnings</b> as its fee. You never get back less than your stake if you win.
        </>,
        <>
          The payout shown before you trade is an <b>estimate</b>. It changes as other people trade, until trading closes.
        </>,
        <>
          You can <b>cash out</b> part or all of a trade any time before trading closes. You get back the amount you take
          out minus a <b>{exitFeePct}% exit fee</b>, so cashing out early always returns less than you put in.
        </>,
        <>
          If nobody traded on the losing side, winners get their stake back. If nobody backed the winning side, everyone is
          refunded.
        </>,
      ],
    },
    {
      title: "How results are decided",
      items: [
        <>Trading stops at the closing time. Anything that happens after it counts as NO.</>,
        <>
          Only the official source named on the market decides the result. Screenshots, rumours and group-chat posts
          don&apos;t count.
        </>,
        <>Winners are paid straight to their wallet as soon as a UniPred admin confirms the result.</>,
        <>
          If the source hasn&apos;t confirmed an outcome within 7 days of closing, or a market turns out to be unclear or
          unfair, it is cancelled and every stake is refunded in full.
        </>,
      ],
    },
    {
      title: "Your account and your money",
      items: [
        <>You must be 18 or older. Only stake money you can afford to lose.</>,
        <>
          <b>One person, one account.</b> Your full name is locked at sign-up and must match your bank account.
        </>,
        <>
          Withdrawals only go to a bank account in your own name. Fund your wallet from your own account too.
        </>,
        <>
          Trying bank accounts in someone else&apos;s name, or linking the same bank account to more than one UniPred
          account, gets your account <b>suspended</b>. Balances of accounts suspended for fraud may be withheld while we
          investigate, as set out in our Terms.
        </>,
        <>
          You can <b>send money to another member</b> by username, any amount up to your wallet balance. You need at least 3 trades placed,
          and both accounts must be at least 3 days old with a verified bank account in the owner&apos;s name. Transfers
          are final.
        </>,
        <>
          Invite friends with your link and earn <b>{referralPct}% of UniPred&apos;s fee</b> on their trades, paid from the
          fee when each market resolves. You start earning from a friend once they&apos;re <b>active</b>: at least 5 trades a
          day for 3 days in a row.
        </>,
        <>
          No market may target a private individual, encourage harm, or be about something a trader can secretly
          control. Such markets are cancelled and refunded.
        </>,
      ],
    },
  ];

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {sections.map((s) => (
        <section key={s.title}>
          <h2 className={`font-bold text-white ${compact ? "mb-1.5 text-sm" : "mb-2 text-base"}`}>{s.title}</h2>
          <ol className={`list-decimal space-y-1.5 pl-5 leading-relaxed text-white/80 ${compact ? "text-[13px]" : "text-sm"}`}>
            {s.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        </section>
      ))}
      <p className={`text-muted ${compact ? "text-xs" : "text-sm"}`}>
        Full details are in our{" "}
        <Link href="/terms" className="text-brand underline" target={compact ? "_blank" : undefined}>
          Terms &amp; Conditions
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-brand underline" target={compact ? "_blank" : undefined}>
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
