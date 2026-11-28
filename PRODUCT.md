# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Everyday Australians about to buy a puppy or kitten from a Gumtree ad, usually on a phone, often minutes before paying a deposit. (Inferred, not yet confirmed by the owner.)

## Product Purpose
PetSales Scam Checker: paste a Gumtree pet listing link (or the ad text and photos) and get a safety score out of 100, with every warning sign explained and linked to its source, before any money changes hands. Success: a buyer either walks away from a scam or verifies a genuine seller before paying.

## Positioning
Run by PetSales.com.au, an Australian pet marketplace. Whether the checker also steers buyers to PetSales listings and PetSales Pay escrow is an open decision (asked, not yet answered).

## Operating Context
- Gumtree blocks server-side page reads, so buyers use a bookmark button that reads the ad in their own browser, or paste the ad text and photos.
- State breeder registers (VIC Pet Exchange Register, NSW Pet Registry, QLD Dog Breeder Register, SA Dogs and Cats Online) are looked up by the buyer; NSW and QLD use CAPTCHAs and SA blocks automated requests, so the product never queries them itself.

## Capabilities and Constraints
More than 30 checks across these areas: scam wording (12 warning patterns, 3 reassuring), breeder and microchip numbers (including state legal requirements and NSW format), price against typical Australian prices for about 30 breeds, reverse image search, copied ad wording, phone and email scam reports and reuse, seller or business name, Facebook and Instagram presence, website age, and ABN status.
- Reverse image search, web search, social and ABN checks need API keys (Google Vision, Brave Search, ABR GUID); without them those checks show as not run.
- Score is uncalibrated against real scam data; weights are starting estimates.

## Brand Commitments
- Logo: PetSales.com.au wordmark in a rounded outline with line-drawn animals above it (`public/logo.png`). Supplied by the owner.
- Background: the indigo behind the owner's logo artwork, implemented as #12053B (owner typed #10253B earlier; exact value awaiting confirmation).
- Accent: #17E4D6, the only accent colour. White text. No other colours without owner approval.
- Photo: the black dog from the PetSales social image (`public/dog.jpg`).

## Evidence on Hand
No testimonials, user counts, or scam statistics exist. Do not invent any. The hero report is an example and must be labelled as one.

## Product Principles
1. Warning signs, never accusations: no wording may call a named seller a scammer.
2. Every finding shows its source so the buyer can judge it.
3. Never claim a check ran when it did not.
4. The buyer's next safe action is always visible.

## Accessibility & Inclusion
WCAG 2.1 AA. Mobile first: most buyers arrive on a phone.
