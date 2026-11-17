import type { Metadata } from "next";
import { Clause, LegalPage, SupportContact } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · UniPred" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what personal data UniPred collects, why, who we share it with and your rights. We handle
          personal data in line with the Nigeria Data Protection Act 2023 (NDPA). UniPred is the data controller for the
          data described here.
        </p>
      }
    >
      <Clause n={1} title="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Account details:</b> email address, password (stored only as a secure hash by our authentication provider),
            full name, username, university and date of birth.
          </li>
          <li>
            <b>Bank and payment details:</b> your payout bank, account number and the account name returned by the bank;
            deposit and withdrawal records. Card details are entered on Paystack&apos;s page and never reach UniPred.
          </li>
          <li>
            <b>Activity:</b> your bets, markets you propose, comments, invite link use, and your wallet transaction history.
          </li>
          <li>
            <b>Technical data:</b> login session cookies, a referral cookie when you arrive through an invite link, and
            standard server logs such as IP address and browser type.
          </li>
        </ul>
      </Clause>

      <Clause n={2} title="Why we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>To create and run your account, wallet and bets (performing our contract with you).</li>
          <li>
            To confirm you are 18 or older, keep to one account per person, match withdrawals to your own bank account and
            prevent fraud and money laundering (legal obligation and legitimate interest).
          </li>
          <li>To process deposits and withdrawals through Paystack.</li>
          <li>To credit invite bonuses to the person who invited you.</li>
          <li>To send essential emails such as sign-up confirmation and password resets.</li>
          <li>To keep the platform secure, fix problems and improve it.</li>
        </ul>
        <p>We don&apos;t sell your personal data and we don&apos;t use it for third-party advertising.</p>
      </Clause>

      <Clause n={3} title="What other people can see">
        <p>
          Other members see your username, your university and any comments you post. When you send money to a
          member, they see your username, the amount and your note. Your full name, email, date of
          birth, balance, bets and bank details are never shown to other members. Result cards you choose to download or
          share show your username, stake and result.
        </p>
      </Clause>

      <Clause n={4} title="Who we share it with">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Paystack</b> (payments, bank account verification and payouts).
          </li>
          <li>
            <b>Supabase</b> (database and authentication) and <b>Vercel</b> (website hosting). These providers may store
            data on servers outside Nigeria; where they do, we rely on the safeguards the NDPA requires for cross-border
            transfers.
          </li>
          <li>Law enforcement, regulators or courts when the law requires it, or to investigate fraud.</li>
        </ul>
      </Clause>

      <Clause n={5} title="How long we keep it">
        <p>
          We keep your account data while your account is open. After it closes, we keep financial and transaction records
          for at least 5 years, as anti-money-laundering rules require, and delete or anonymise other data when it&apos;s
          no longer needed.
        </p>
      </Clause>

      <Clause n={6} title="Your rights">
        <p>Under the NDPA you can ask us to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>give you a copy of your personal data;</li>
          <li>correct data that is wrong (your full name can only be corrected after we verify your identity);</li>
          <li>delete your data, where we&apos;re not required to keep it;</li>
          <li>restrict or object to how we use it, or move it to another service.</li>
        </ul>
        <p>
          Contact us at <SupportContact />. If you&apos;re not satisfied with our answer, you can complain to the Nigeria
          Data Protection Commission (NDPC).
        </p>
      </Clause>

      <Clause n={7} title="Cookies">
        <p>
          We use only the cookies needed to run UniPred: a login session cookie and, if you arrive through someone&apos;s
          invite link, a referral cookie that lasts 30 days. We don&apos;t use advertising or tracking cookies.
        </p>
      </Clause>

      <Clause n={8} title="Security">
        <p>
          Data is encrypted in transit, access to your records is restricted to you by database security rules, and every
          balance change is recorded in an audit ledger. No system is perfectly secure, so please use a strong password
          that you don&apos;t use anywhere else.
        </p>
      </Clause>

      <Clause n={9} title="Children">
        <p>UniPred is only for people aged 18 and over. We close accounts we find belong to anyone younger.</p>
      </Clause>

      <Clause n={10} title="Changes">
        <p>
          We&apos;ll update this policy when our practices change and show the new date at the top. Significant changes
          will be announced in the app.
        </p>
      </Clause>
    </LegalPage>
  );
}
