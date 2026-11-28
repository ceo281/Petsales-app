import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of use and disclaimer | PetSales Scam Checker",
  description: "What the PetSales Scam Checker is, what it is not, and the terms that apply when you use it.",
};

// Draft for legal review. Have an Australian lawyer review before public launch.
export default function Terms() {
  return (
    <main className="legal wrap" id="main">
      <a className="legal-back" href="/">Back to the Scam Checker</a>
      <h1 className="legal-title">Terms of use and disclaimer</h1>
      <p className="legal-updated">Last updated 28 November 2026</p>

      <section>
        <h2>1. What this service is</h2>
        <p>
          The PetSales Scam Checker (the &quot;Service&quot;) is a free, automated tool provided by PetSales.com.au
          (&quot;PetSales&quot;, &quot;we&quot;, &quot;us&quot;). It looks at the information in a pet advertisement that you
          give it, compares that information with common patterns seen in pet scams, and searches some public sources. It
          then produces a report with a score and a list of warning signs.
        </p>
      </section>

      <section>
        <h2>2. What this service is not</h2>
        <ul>
          <li>It is <strong>not proof</strong> that any person or business is a scammer, or that any person or business is genuine.</li>
          <li>It does <strong>not accuse</strong> anyone of anything. A warning sign means only that the ad shows a pattern worth checking.</li>
          <li>It is <strong>not legal, financial, veterinary or other professional advice</strong>, and it is not a substitute for your own enquiries.</li>
          <li>It does <strong>not guarantee</strong> any result. A high score does not mean an ad is safe. A low score does not mean an ad is a scam.</li>
        </ul>
      </section>

      <section>
        <h2>3. Where the information comes from</h2>
        <p>
          Reports are generated automatically from the advertisement text and photos you provide, and from third-party
          sources such as search engines, image search, and public government registers (for example, state breeder
          registers and the ABN Lookup service). We do not control those sources. Their information may be incomplete,
          out of date or wrong, and search results can match a different person or business with a similar name or number.
          We do not check reports manually before you see them.
        </p>
      </section>

      <section>
        <h2>4. Your responsibilities</h2>
        <p>By using the Service you agree that:</p>
        <ul>
          <li>you use each report only as one input to your own decision, and you make your own enquiries before paying any money;</li>
          <li>you will see the pet in person (or by a live video call), verify the seller and any breeder or microchip numbers, and avoid paying deposits to people you have not met;</li>
          <li>you will not publish, share or use a report, or any part of it, to accuse, threaten, harass or contact a seller, or to damage anyone&apos;s reputation;</li>
          <li>you will only submit advertisements you are entitled to view, and you will not use the Service in a way that breaks any law or another website&apos;s terms;</li>
          <li>you will not try to overload, copy or automate the Service.</li>
        </ul>
      </section>

      <section>
        <h2>5. Australian Consumer Law and our liability</h2>
        <p>
          Nothing in these terms excludes, restricts or modifies any right or remedy, or any guarantee, warranty or other term
          or condition, implied or imposed by the Australian Consumer Law or any other law that cannot lawfully be excluded
          or limited.
        </p>
        <p>
          Subject to that, the Service is provided free of charge and &quot;as is&quot;. To the extent permitted by law, we
          make no representation or warranty that a report is accurate, complete or suitable for any purpose, and we are not
          liable for any loss or damage (including loss of money, a pet, or any indirect or consequential loss) arising from
          your use of, or reliance on, the Service or any report.
        </p>
      </section>

      <section>
        <h2>6. Privacy</h2>
        <p>
          To run a check, the ad details you provide are sent to our server and, where needed, to third-party search and
          register services. We do not ask for your name or contact details to use the Service, and we do not keep the reports
          we generate. We keep a running count of how many checks have been run. Ad text and photos you submit may contain
          a seller&apos;s published contact details; only submit what appears in the ad itself.
        </p>
      </section>

      <section>
        <h2>7. If you are a seller</h2>
        <p>
          Reports are generated on request from the ad&apos;s own content and are not published by us. If you believe the
          Service treats your genuine listing unfairly, please contact PetSales through{" "}
          <a href="https://www.petsales.com.au" target="_blank" rel="noreferrer">petsales.com.au</a> so we can review the
          rules that produced the result.
        </p>
      </section>

      <section>
        <h2>8. Changes</h2>
        <p>
          We may change the Service or these terms at any time. The version on this page applies from the date shown above.
        </p>
      </section>

      <section>
        <h2>9. Report a scam</h2>
        <p>
          If you think you have found or been caught by a scam, report it to{" "}
          <a href="https://www.scamwatch.gov.au/report-a-scam" target="_blank" rel="noreferrer">Scamwatch</a> and to the
          website where the ad appeared, and contact your bank straight away if you have paid.
        </p>
      </section>
    </main>
  );
}
