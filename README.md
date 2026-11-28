# PetSales Scam Checker

A website where people buying a pet on Gumtree paste the listing link (or the ad text and photos) and get a **safety score out of 100**, with the reasons behind it.

## What it checks

| Check | How | Needs |
|---|---|---|
| Scam-language scan | Shipping/pet transport, gift cards/crypto, deposits before viewing, PayID-only, "relocating overseas", WhatsApp-only, AKC papers, crate/insurance fees, and more | nothing |
| Breeder ID | Looks for a breeder/source/supply/microchip number. Flags its absence in VIC, NSW, QLD, SA, where ads must show one | nothing |
| Price vs market | Flags prices far below typical AU prices for ~30 popular breeds (`lib/breeds.ts`) | nothing |
| Reverse image search | Google Cloud Vision *Web Detection*: are the ad photos on other websites? | `GOOGLE_VISION_API_KEY` |
| Text, name and phone search | Searches the web for a sentence from the ad (copy-paste scam templates), the phone numbers and emails (scam reports), and the seller/business name next to "scam/fraud" | `BRAVE_SEARCH_API_KEY` |
| Facebook and Instagram | Web search restricted to facebook.com and instagram.com for the business name and phone. Returns links for the buyer to check | `BRAVE_SEARCH_API_KEY` |
| Website age | RDAP lookup on any website in the ad. Brand-new domains are flagged | nothing |
| ABN | ABN Lookup: is the ABN active, and is the business name registered? | `ABR_GUID` (free) |

Every check that can't run (missing key, nothing to look up) is shown as not run, and the **"checks completed"** figure drops. One severe flag (stolen photos, phone number in scam reports, price under 40% of market) caps the score at 45, so nice wording can't outweigh it.

## Run it

```bash
npm install
cp .env.example .env.local   # add whichever keys you have
npm run dev                  # http://localhost:3000
```

It deploys to Vercel as-is. Add the same environment variables in the project settings.

## Known limits (read before launch)

- **Gumtree blocks server-side fetching.** Requests from our server get a JavaScript "Browser Challenge" (HTTP 403). We don't try to get around it, because that breaches Gumtree's terms and breaks whenever they change it. Instead the site offers:
  1. a **bookmarklet** ("🐾 Check this pet ad") that reads the ad in the buyer's own browser and sends it to the checker, and
  2. **paste the ad text and upload the photos**.
  On mobile, where most buyers are, bookmarklets are awkward. A browser extension, or a share-sheet / PWA flow, is the next step.
- **Facebook and Instagram can't be queried directly.** Meta's APIs don't let you look up arbitrary profiles, and scraping them breaches their terms. We search the public web for pages on those sites and hand the links to the buyer.
- **Scores are uncalibrated.** The point weights in `lib/checks/*.ts` are starting estimates. Before launch, collect real listings (confirmed scams from Scamwatch and buyer reports, plus known-good breeders) and tune the weights against them.
- **Breed prices** in `lib/breeds.ts` are rough. Replace them with PetSales market data.
- **State breeder-ID rules** change. Confirm the current VIC/NSW/QLD/SA/WA/TAS rules and register links in `lib/checks/local.ts`.

## Weather widget

A floating weather card (bottom-right on every page) showing local conditions, today's min/max, a 4-day outlook and a pet-care tip (heat, storms, UV, cold, rain). The card colour changes with the conditions. It refreshes every 10 minutes while the tab is visible, catches up when the tab is reopened, and can be minimised to a small chip.

**Location:** first the visitor's approximate location from Vercel's IP geo headers (no permission prompt). They can tap "Use my location" (browser GPS, rounded to ~1 km) or type a postcode/suburb. The choice is remembered in their browser. Running locally there are no IP headers, so it asks for a location.

**Data sources and licences**

| What | Source | Licence / cost |
|---|---|---|
| Forecast + current conditions | [MET Norway Locationforecast](https://api.met.no/doc/TermsOfService) | Free, commercial use allowed, CC BY 4.0. Attribution shown in the widget |
| Place names, postcode search | [OpenStreetMap Nominatim](https://operations.osmfoundation.org/policies/nominatim/) | Free, ODbL. Max 1 req/s, so results are cached 30 days |

**Why not BOM:** BOM's free feeds (anonymous FTP and the web JSON products) are "not for commercial use", and `api.weather.bom.gov.au` says in every response "You must not use, copy or share it". Commercial access to live BOM data needs a paid [Registered User Services](https://www.bom.gov.au/resources/data-services) subscription. If PetSales buys one, add `lib/weather/bom.ts` returning the same `WeatherPayload` and swap it in `app/api/weather/route.ts`.

**Before launch:**
- Set `WEATHER_USER_AGENT` to something with a contact URL/email. Both MET Norway and Nominatim block anonymous traffic.
- Nominatim's public server is for light use. If the GPS/postcode lookups get busy, switch to a paid geocoder or a bundled AU postcode list.
- MET Norway is a model forecast (ECMWF-based). It isn't BOM's official forecast and has **no Australian warnings** (storms, fire danger). Don't present it as official warnings.
- UV is MET's clear-sky value, which overstates on cloudy days. The widget labels it as clear-sky and only shows a UV tip on fine days.

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
app/api/weather/route.ts  API: weather for ?lat&lon | ?q=postcode | IP location
app/components/Weather*   floating widget + icons
lib/weather/            MET Norway forecast shaping, geocoding, pet tips
```
