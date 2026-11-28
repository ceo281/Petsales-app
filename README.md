# PetSales Scam Checker

A website where people buying a pet on Gumtree paste the listing link (or the ad text and photos) and get a **safety score out of 100**, with the reasons behind it.

## What it checks

| Check | How | Needs |
|---|---|---|
| Scam-language scan | Shipping/pet transport, gift cards/crypto, deposits before viewing, PayID-only, "relocating overseas", WhatsApp-only, AKC papers, crate/insurance fees, and more | nothing |
| Breeder ID | Looks for a breeder/source/supply/microchip number. Flags its absence in VIC, NSW, QLD, SA, where ads must show one | nothing |
| Price vs market | Flags prices far below typical AU prices for ~30 popular breeds (`lib/breeds.ts`) | nothing |
| Reverse image search | Google Lens through Serper.dev for ad photo links; Google Cloud Vision for uploaded photos: are the ad photos on other websites? | `SERPER_API_KEY`, optional `GOOGLE_VISION_API_KEY` |
| Text, name and phone search | Searches the web for a sentence from the ad (copy-paste scam templates), the phone numbers and emails (scam reports), and the seller/business name next to "scam/fraud" | `SERPER_API_KEY` (Serper.dev) |
| Facebook and Instagram | Web search restricted to facebook.com and instagram.com for the business name and phone. Returns links for the buyer to check | `SERPER_API_KEY` (Serper.dev) |
| Website age | RDAP lookup on any website in the ad. Brand-new domains are flagged | nothing |
| ABN | ABN Lookup: is the ABN active, and is the business name registered? | `ABR_GUID` (free) |

Every check that can't run (missing key, nothing to look up) is shown as not run, and the **"checks completed"** figure drops. One severe flag (stolen photos, phone number in scam reports, price under 40% of market) caps the score at 45, so nice wording can't outweigh it.

## Run it

```bash
npm install
cp .env.example .env.local   # add whichever keys you have
npm run dev                  # http://localhost:3000
```

Hosting: Replit. Import the repo, add the keys under Tools > Secrets, then Deploy (the `.replit` file sets the build and start commands). Host in an Australian region if offered, so the SA breeder register (which blocks non-Australian servers) can be added.

## Known limits (read before launch)

- **Gumtree blocks server-side fetching.** Requests from our server get a JavaScript "Browser Challenge" (HTTP 403). We don't try to get around it, because that breaches Gumtree's terms and breaks whenever they change it. Instead the site offers:
  1. a **bookmarklet** ("🐾 Check this pet ad") that reads the ad in the buyer's own browser and sends it to the checker, and
  2. **paste the ad text and upload the photos**.
  On mobile, where most buyers are, bookmarklets are awkward. A browser extension, or a share-sheet / PWA flow, is the next step.
- **Facebook and Instagram can't be queried directly.** Meta's APIs don't let you look up arbitrary profiles, and scraping them breaches their terms. We search the public web for pages on those sites and hand the links to the buyer.
- **Scores are uncalibrated.** The point weights in `lib/checks/*.ts` are starting estimates. Before launch, collect real listings (confirmed scams from Scamwatch and buyer reports, plus known-good breeders) and tune the weights against them.
- **Breed prices** in `lib/breeds.ts` are rough. Replace them with PetSales market data.
- **State breeder-ID rules** change. Confirm the current VIC/NSW/QLD/SA/WA/TAS rules and register links in `lib/checks/local.ts`.

## Legal note: defamation

The site shows warning signs about named people and businesses. In Australia, a business with fewer than 10 employees, or an individual, can sue over a published statement that harms their reputation. The wording is therefore deliberately "warning signs found" and never "this seller is a scammer", and every name and phone match links to the source so the buyer can judge it. Get legal review of the wording, the terms of use, and a takedown/dispute process before public launch. Do not store or publish a public "scammer list" without that review.

## Layout

```
app/page.tsx            UI, bookmarklet, report view
app/api/check/route.ts  API: accepts {url} | {capture} | {manual}
lib/fetchListing.ts     server fetch + HTML/JSON-LD parsing
lib/extract.ts          phones, emails, URLs, ABNs (checksum-validated), state, breed, business name
lib/checks/local.ts     language, breeder ID, price checks
lib/checks/remote.ts    image, web, social, domain, ABN checks
lib/score.ts            scoring, confidence, manual-check links
```
