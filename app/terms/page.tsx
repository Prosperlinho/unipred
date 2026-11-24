import type { Metadata } from "next";
import Link from "next/link";
import { Clause, LegalPage, SupportContact } from "@/components/LegalPage";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Terms & Conditions · UniPred" };

export default async function TermsPage() {
  const s = await getSettings();
  const fee = s.pool_fee_bps / 100;
  const ref = s.referral_share_bps / 100;
  const exitFee = s.exit_fee_bps / 100;

  return (
    <LegalPage
      title="Terms & Conditions"
      intro={
        <p>
          These Terms are an agreement between you and UniPred (&ldquo;UniPred&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
          By creating an account or using the platform you agree to them, together with our{" "}
          <Link href="/rules" className="text-brand underline">
            House Rules
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-brand underline">
            Privacy Policy
          </Link>
          . If you don&apos;t agree, please don&apos;t use UniPred.
        </p>
      }
    >
      <Clause n={1} title="What UniPred is">
        <p>
          UniPred is a prediction platform where members back YES or NO on the outcome of events, mostly about university
          life in Nigeria. Trades are settled through pool trading: stakes go into a pot for each side and winners share the
          losing side&apos;s pot, as described in the House Rules. UniPred is not a party to any trade and does not trade
          against members.
        </p>
        <p>
          While UniPred runs in test mode, payments use test cards and no real money moves. Before real-money operation,
          UniPred will obtain the approvals required by Nigerian law and these Terms will be updated.
        </p>
      </Clause>

      <Clause n={2} title="Who can use UniPred">
        <ul className="list-disc space-y-1 pl-5">
          <li>You must be at least 18 years old and legally able to enter this agreement.</li>
          <li>You must live in Nigeria and use UniPred only where taking part is lawful for you.</li>
          <li>
            <b>One person, one account.</b> You may hold only one UniPred account, in your own name.
          </li>
          <li>
            The full name you give at sign-up must be your real name, exactly as it appears on your bank account. It
            can&apos;t be changed afterwards.
          </li>
        </ul>
      </Clause>

      <Clause n={3} title="Your account">
        <p>
          Keep your login details private. You are responsible for everything done through your account. Tell us
          immediately at <SupportContact /> if you think someone else has accessed it.
        </p>
      </Clause>

      <Clause n={4} title="Wallet, deposits and withdrawals">
        <ul className="list-disc space-y-1 pl-5">
          <li>Deposits are processed by Paystack. Fund your wallet only from payment methods in your own name.</li>
          <li>
            Withdrawals are paid only to a Nigerian bank account whose name matches your UniPred full name. Each bank
            account can be linked to one UniPred account only.
          </li>
          <li>
            Withdrawals are reviewed before they are sent. We may ask for identity documents (for example a valid ID, BVN
            or NIN details) before paying out, and may delay a withdrawal while a check is completed.
          </li>
          <li>Minimum amounts for trades, deposits and withdrawals are shown in the app and may change.</li>
          <li>Your wallet balance is not a bank deposit and earns no interest.</li>
          <li>
            You may send money from your wallet to another member by username, within the daily limits shown in the app.
            You must have placed at least 3 trades, both accounts must be at least 3 days old with a verified bank account
            in the owner&apos;s own name, and transfers are final. Transfers can&apos;t be used to pay for goods or
            services, to launder money, or to get around a suspension; transfers we find were used that way may be
            reversed and the accounts suspended.
          </li>
        </ul>
      </Clause>

      <Clause n={5} title="Trades, results and fees">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Once confirmed, a trade can&apos;t be changed. Before trading closes you may cash out part or all of it and receive
            the amount taken out minus a {exitFee}% exit fee; after closing, trades can&apos;t be cashed out.
          </li>
          <li>Payout figures shown before you trade are estimates; the final amount depends on all trades placed before closing.</li>
          <li>
            Results are decided by UniPred admins using the official source named on each market. Our decision is final,
            except where we made a clear error, which we will correct.
          </li>
          <li>UniPred&apos;s fee is {fee}% of the winnings paid from the losing pot. Fees may change for future markets.</li>
          <li>Markets may be cancelled with all stakes refunded in the situations described in the House Rules.</li>
        </ul>
      </Clause>

      <Clause n={6} title="Proposing markets">
        <p>
          You may propose markets. Proposals must be about real, verifiable events, must name an official source, and must
          not target private individuals, encourage harm, invade anyone&apos;s privacy or concern something a member can
          secretly control. We may edit, decline or cancel any market.
        </p>
      </Clause>

      <Clause n={7} title="Invite programme">
        <p>
          Members may share an invite link. Once someone who joined through your link is active (at least 5 trades a day
          on 3 days in a row, Lagos time), you earn {ref}% of UniPred&apos;s fee on the share of the pot their trades made
          up, for every market that resolves after they became active. Markets that resolved before your friend became
          active earn no bonus, and it isn&apos;t paid later. UniPred may agree a different rate with partners. Invite bonuses
          come only out of UniPred&apos;s fee. Inviting yourself or fake accounts is fraud: bonuses earned that way are
          reversed and the accounts involved may be suspended. We may change or end the programme with notice in the app.
        </p>
      </Clause>

      <Clause n={8} title="Things you must not do">
        <ul className="list-disc space-y-1 pl-5">
          <li>Create or control more than one account, or use another person&apos;s identity, bank account or card.</li>
          <li>Trade on markets whose outcome you can influence or already know from inside information.</li>
          <li>Work with others to manipulate outcomes or the platform.</li>
          <li>Use bots, scripts or exploits, or try to access accounts or data that aren&apos;t yours.</li>
          <li>Post abusive, hateful, defamatory or illegal content in comments or market proposals.</li>
          <li>Use UniPred to launder money or for any other unlawful purpose.</li>
        </ul>
      </Clause>

      <Clause n={9} title="Suspension and closure">
        <p>
          We may suspend or close an account that breaks these Terms or the House Rules, including trying to withdraw to
          a bank account in another name or linking one bank account to several UniPred accounts. While an account is
          suspended, trading, proposals and withdrawals are disabled.
        </p>
        <p>
          Where we find fraud, multiple accounts or other serious abuse, we may withhold the balance of the accounts
          involved while we investigate, void trades and bonuses obtained through the abuse, and report the matter to the
          relevant authorities, to the extent allowed by Nigerian law. Balances that are not connected to the abuse will
          be returned to a verified bank account in your name when the review ends.
        </p>
      </Clause>

      <Clause n={10} title="Play responsibly">
        <p>
          Only stake money you can afford to lose. Never borrow, or use school fees or money meant for essentials, to
          trade. If trading stops being fun, take a break and talk to someone you trust. You can ask us at{" "}
          <SupportContact /> to close your account.
        </p>
      </Clause>

      <Clause n={11} title="Liability">
        <p>
          UniPred is provided &ldquo;as is&rdquo;. We work hard to keep it accurate and available but can&apos;t promise
          it will always be uninterrupted or error-free. To the extent allowed by law, we are not liable for indirect or
          consequential losses, and our total liability to you is limited to the balance of your wallet. Nothing in these
          Terms limits rights you have under Nigerian consumer protection law that can&apos;t be limited.
        </p>
      </Clause>

      <Clause n={12} title="Changes, law and contact">
        <p>
          We may update these Terms. If a change matters, you&apos;ll be asked to accept the new version before you
          continue. These Terms are governed by the laws of the Federal Republic of Nigeria, and disputes will be handled
          by Nigerian courts. Complaints about a result must be raised within 7 days of the market resolving. Contact us
          at <SupportContact />.
        </p>
      </Clause>
    </LegalPage>
  );
}
