import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms | PetSales Scam Checker",
  description: "The plain-English terms for using the free PetSales Scam Checker.",
};

// Plain-English draft. Have an Australian lawyer review before public launch.
export default function Terms() {
  return (
    <main className="legal wrap" id="main">
      <a className="legal-back" href="/">Back to the Scam Checker</a>
      <h1 className="legal-title">The terms, in plain English</h1>
      <p className="legal-updated">Last updated 28 November 2026</p>

      <section className="legal-short">
        <h2>The short version</h2>
        <ul>
          <li>Scam Checker is free and looks for warning signs in pet ads.</li>
          <li>It helps you decide. It doesn&apos;t make the decision for you, and it can be wrong.</li>
          <li>Always meet the pet and check the seller before you pay anything.</li>
          <li>Please don&apos;t use a report to call out or contact a seller.</li>
          <li>We don&apos;t keep your reports or ask who you are.</li>
        </ul>
      </section>

      <section>
        <h2>What it does</h2>
        <p>
          PetSales.com.au (&quot;we&quot;) runs the Scam Checker. You give it a pet ad, and it compares the ad with patterns
          we see in pet scams, searches some public sources, and gives you a score with the reasons behind it.
        </p>
      </section>

      <section>
        <h2>What it doesn&apos;t do</h2>
        <p>
          A report is a set of warning signs, not a verdict. It doesn&apos;t prove that anyone is a scammer or that anyone is
          genuine. A good score doesn&apos;t mean an ad is safe, and a low score doesn&apos;t mean it&apos;s a scam. It isn&apos;t
          legal, financial or vet advice.
        </p>
      </section>

      <section>
        <h2>Where the results come from</h2>
        <p>
          Reports are made automatically from the ad you give us, plus search engines, image search and public registers
          such as state breeder registers and ABN Lookup. We don&apos;t control those sources, so they can be out of date, and a
          search can turn up a different person or business with a similar name. Nobody at PetSales reviews a report before
          you see it.
        </p>
      </section>

      <section>
        <h2>What we ask of you</h2>
        <ul>
          <li>Use the report as one part of your own checks, not the only one.</li>
          <li>See the pet in person or on a live video call, check any breeder or microchip numbers, and don&apos;t pay a deposit to someone you haven&apos;t met.</li>
          <li>Don&apos;t post, share or use a report to accuse, threaten or contact a seller, or to hurt anyone&apos;s reputation.</li>
          <li>Only check ads you can view yourself, and don&apos;t try to overload, copy or automate the service.</li>
        </ul>
      </section>

      <section>
        <h2>Our responsibility</h2>
        <p>
          Your rights under the Australian Consumer Law always apply, and nothing here takes them away.
        </p>
        <p>
          Beyond that, the Scam Checker is free and provided as it is. As far as the law allows, we can&apos;t promise a report is
          complete or correct, and we aren&apos;t responsible for any loss (including money or a pet) that comes from relying on it.
        </p>
      </section>

      <section>
        <h2>Your privacy</h2>
        <p>
          To run a check, the ad details go to our server and, where needed, to search and register services. We don&apos;t ask
          for your name or contact details and we don&apos;t keep reports. We only keep a running count of checks. Please only
          submit what&apos;s in the ad itself.
        </p>
      </section>

      <section>
        <h2>If you&apos;re the seller</h2>
        <p>
          Reports are made on request from your ad&apos;s own content, and we don&apos;t publish them. If you think your genuine
          ad has been treated unfairly, contact us through{" "}
          <a href="https://www.petsales.com.au" target="_blank" rel="noreferrer">petsales.com.au</a> and we&apos;ll look at the
          rules behind it.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>We may update the service or these terms. The version on this page applies from the date at the top.</p>
      </section>

      <section>
        <h2>Think you&apos;ve been scammed?</h2>
        <p>
          Call your bank straight away if you&apos;ve paid, then report it to{" "}
          <a href="https://www.scamwatch.gov.au/report-a-scam" target="_blank" rel="noreferrer">Scamwatch</a> and the site
          where the ad appeared.
        </p>
      </section>
    </main>
  );
}
