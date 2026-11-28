import type { CheckResult, Extracted, Listing, Report } from "./types";
import { extract } from "./extract";
import { breederIdCheck, priceCheck, textCheck } from "./checks/local";
import { abnCheck, domainCheck, imageCheck, socialCheck, webCheck } from "./checks/remote";
import { lookupBreederNumber } from "./registers";

/**
 * Score = 100 is lowest risk. We start from a neutral 70 rather than 100 so a
 * listing that we know little about can't score as "safe" by default.
 */
const BASE = 70;

/** Checks that carry the most evidence count double towards confidence. */
const WEIGHT: Record<string, number> = { images: 2, web: 2, text: 1, breeder: 1, price: 1, social: 1, domain: 0.5, abn: 0.5 };

export async function runChecks(listing: Listing): Promise<Report> {
  const x: Extracted = extract(listing);
  const breeder = breederIdCheck(listing, x);
  await addRegisterLookup(breeder, x);
  const checks: CheckResult[] = [
    textCheck(listing),
    breeder,
    priceCheck(listing, x),
    ...(await Promise.all([imageCheck(listing), webCheck(listing, x), socialCheck(listing, x), domainCheck(x), abnCheck(x)])),
  ];

  const total = checks.flatMap((c) => c.signals).reduce((s, sig) => s + sig.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(BASE + total)));

  // Confidence = weighted share of the evidence-heavy checks that actually ran.
  const possible = checks.filter((c) => c.status !== "na").reduce((s, c) => s + (WEIGHT[c.id] ?? 1), 0);
  const ran = checks.filter((c) => c.status === "ran").reduce((s, c) => s + (WEIGHT[c.id] ?? 1), 0);

  // Any single severe flag caps the score — one stolen photo or scam report outweighs nice wording.
  const severe = checks.flatMap((c) => c.signals).some((s) => s.points <= -22);
  const capped = severe ? Math.min(score, 45) : score;

  return {
    score: capped,
    band: capped < 50 ? "high-risk" : capped < 80 ? "caution" : "lower-risk",
    confidence: Math.round((ran / possible) * 100) / 100,
    listing: {
      url: listing.url,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      priceText: listing.priceText,
      location: listing.location,
      sellerName: listing.sellerName,
      imageCount: listing.images.length,
    },
    extracted: x,
    checks,
    manualLinks: manualLinks(listing, x),
  };
}

/** Look the breeder number up on the state register where that is allowed (VIC, QLD). */
async function addRegisterLookup(check: CheckResult, x: Extracted) {
  const shown = check.signals.find((s) => s.copy && !/^Microchip/.test(s.label));
  if (!shown?.copy || (x.state !== "VIC" && x.state !== "QLD")) return;
  const register = x.state === "VIC" ? "Victorian Pet Exchange Register" : "Queensland Dog Breeder Register";
  const r = await lookupBreederNumber(x.state, shown.copy);
  if (r.status === "found") {
    shown.points = 8;
    shown.label = `${shown.copy} is on the ${register}`;
    shown.detail = `${r.detail ? `${r.detail} ` : ""}The number is real, but scammers copy real breeders' numbers. Ask the seller for ID and make sure their name matches the registered breeder.`;
  } else if (r.status === "notfound") {
    shown.points = -25;
    shown.label = `${shown.copy} is not on the ${register}`;
    shown.detail = "We searched the official register and this number doesn't exist. Don't pay until the seller gives you a number that checks out.";
  } else {
    shown.detail = `We couldn't reach the ${register} just now (${r.reason}). ${shown.detail}`;
  }
}

function manualLinks(l: Listing, x: Extracted) {
  const g = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const links: { title: string; url: string }[] = [];
  const firstImg = l.images.find((i) => i.startsWith("http"));
  if (firstImg) {
    links.push({ title: "Google Lens: first photo", url: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(firstImg)}` });
    links.push({ title: "TinEye: first photo", url: `https://tineye.com/search?url=${encodeURIComponent(firstImg)}` });
  }
  for (const p of x.phones.slice(0, 2)) links.push({ title: `Search phone ${p}`, url: g(`"${p}"`) });
  const name = x.businessName || l.sellerName;
  if (name) {
    links.push({ title: `Search "${name}" + scam`, url: g(`"${name}" scam`) });
    links.push({ title: `Facebook search: ${name}`, url: `https://www.facebook.com/search/top?q=${encodeURIComponent(name)}` });
  }
  links.push({ title: "Scamwatch: pet scams", url: "https://www.scamwatch.gov.au/types-of-scams/online-shopping-scams" });
  return links;
}
