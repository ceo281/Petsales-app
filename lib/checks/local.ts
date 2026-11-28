import type { CheckResult, Extracted, Listing, Signal } from "../types";
import { BREED_PRICES } from "../breeds";

/**
 * Language patterns seen repeatedly in Australian pet scams (Scamwatch,
 * RSPCA and ACCC guidance). Points are a starting calibration — tune them
 * against real reported-scam vs genuine listings before trusting the score.
 */
const RED_FLAGS: { re: RegExp; points: number; label: string }[] = [
  { re: /\b(ship|shipping|courier|freight|pet transport|air ?freight|airline|fly (him|her|them|the pup)|deliver(y|ed)? (to|across|anywhere)|interstate delivery|door to door)\b/i, points: -20, label: "Offers shipping / pet transport instead of pick-up" },
  { re: /\b(western union|moneygram|gift ?cards?|itunes|steam card|bitcoin|crypto|usdt|wise transfer)\b/i, points: -25, label: "Asks for an untraceable payment method" },
  { re: /\b(deposit|hold (him|her|the pup)|secure (him|her|your pup)|reserve (him|her))\b[^.]{0,60}\b(before|prior|to hold|non.?refundable)\b|\bnon.?refundable deposit\b/i, points: -12, label: "Wants a deposit before you see the pet" },
  { re: /\b(bank transfer|payid|pay ?id|osko)\b[^.]{0,40}\b(only|upfront|first)\b/i, points: -12, label: "Bank transfer / PayID only, up front" },
  { re: /\b(no (viewings?|inspections?|visits?)|can'?t (meet|view)|not available to view|working (overseas|offshore)|on (a )?mission|deployed|fifo)\b/i, points: -15, label: "Seller can't meet in person" },
  { re: /\b(relocat(ing|ion)|moving overseas|passed away|my late|deceased|lost my (job|husband|wife))\b/i, points: -8, label: "Sob-story / relocation reason (common scam script)" },
  { re: /\b(whatsapp|text only|email only|sms only|don'?t call|no calls|contact (me )?(via|on) (email|whatsapp))\b/i, points: -8, label: "Pushes contact off-platform / text-only" },
  { re: /\b(akc|ckc|american kennel club)\b/i, points: -6, label: "Mentions US kennel clubs (AKC/CKC), unusual for Aussie breeders" },
  { re: /\b(urgent(ly)?|first come first serve|today only|must go (today|asap)|won'?t last)\b/i, points: -5, label: "Urgency pressure" },
  { re: /\b(free to (a )?good home|free puppy|free kitten)\b/i, points: -8, label: "'Free' pet, often a lure for transport or vet 'fees'" },
  { re: /\b(teacup|micro ?mini|pocket size)\b/i, points: -4, label: "'Teacup' marketing (welfare + scam red flag)" },
  { re: /\b(insurance fee|crate fee|transport fee|vaccination fee|customs|quarantine fee)\b/i, points: -20, label: "Mentions extra fees (crate, insurance, quarantine): a classic scam escalation" },
];

const GREEN_FLAGS: { re: RegExp; points: number; label: string }[] = [
  { re: /\b(come (and|&) (meet|visit)|welcome to visit|inspection welcome|meet (the )?(parents|mum|mother))\b/i, points: 5, label: "Invites you to visit / meet the parents" },
  { re: /\b(ancc|ankc|dogs (nsw|victoria|queensland|sa|west|tasmania|act)|felis|cats victoria|qfa|member (no|number|#))\b/i, points: 6, label: "Mentions a recognised breed-club membership (verify the number!)" },
  { re: /\b(vet check(ed)?|health (test|tested|guarantee)|dna (test|tested)|hip (and|&) elbow)\b/i, points: 2, label: "Mentions health testing (verify with the paperwork)" },
];

export function textCheck(l: Listing): CheckResult {
  const text = `${l.title}\n${l.description}\n${l.rawText}`;
  const signals: Signal[] = [];
  for (const f of [...RED_FLAGS, ...GREEN_FLAGS]) {
    const m = text.match(f.re);
    if (m) signals.push({ points: f.points, label: f.label, detail: `Found: "${m[0]}"` });
  }
  if (text.replace(/\s/g, "").length < 120)
    signals.push({ points: 0, label: "Very little listing text available", detail: "Paste the full description for a better check." });
  return { id: "text", name: "Scam-language scan", status: "ran", signals };
}

/**
 * Several states require a breeder/source identifier in every advertisement.
 * Formats vary and change, so we look for the labelled number rather than
 * validating a strict pattern. Confirm current rules with each state before
 * launch: VIC Pet Exchange Register "source number"; NSW Pet Registry
 * "breeder identification number" (BIN); QLD "supply number"; SA DACO
 * registration number.
 */
const STATE_ID: Partial<Record<NonNullable<Extracted["state"]>, { name: string; lookup?: string }>> = {
  VIC: { name: "Pet Exchange Register source number", lookup: "https://per.animalwelfare.vic.gov.au/" },
  NSW: { name: "breeder identification number (BIN)", lookup: "https://www.petregistry.nsw.gov.au/" },
  QLD: { name: "supply number / breeder ID", lookup: "https://www.daf.qld.gov.au/business-priorities/biosecurity/animal-biosecurity-welfare/animal-health-pests-diseases/dog-breeder-registration" },
  SA: { name: "DACO breeder registration number", lookup: "https://www.dogandcatboard.com.au/" },
};

export function breederIdCheck(l: Listing, x: Extracted): CheckResult {
  const text = `${l.title}\n${l.description}\n${l.rawText}`;
  const signals: Signal[] = [];
  const idMatch = text.match(
    /\b(source (no|number|#)|breeder (id|identification|number|no|#)|\bBIN\b|supply (no|number|#)|daco|per (no|number|#)|microchip (no|number|#))\b[^\n]{0,25}?([A-Z]{0,4}[\s-]?\d{5,15})/i
  );
  const req = x.state ? STATE_ID[x.state] : undefined;
  const isDogOrCat = /\b(puppy|puppies|pup|pups|dog|kitten|kittens|cat)\b/i.test(text);

  if (idMatch) {
    signals.push({
      points: 6,
      label: "Breeder / source / microchip number is shown",
      detail: `Found "${idMatch[0].trim()}". A number alone proves nothing. Look it up on the official register and check the name matches.`,
      links: req?.lookup ? [{ title: `Verify on the ${x.state} register`, url: req.lookup }] : undefined,
    });
  } else if (req && isDogOrCat) {
    signals.push({
      points: -15,
      label: `No ${req.name} in the ad`,
      detail: `Dog and cat ads in ${x.state} must show this number by law. Ask the seller for it and verify it before paying anything.`,
      links: req.lookup ? [{ title: `${x.state} register`, url: req.lookup }] : undefined,
    });
  } else if (isDogOrCat) {
    signals.push({ points: -3, label: "No breeder or microchip number shown", detail: "Ask for one and verify it." });
  }
  return { id: "breeder", name: "Breeder ID / microchip check", status: "ran", signals };
}

export function priceCheck(l: Listing, x: Extracted): CheckResult {
  const signals: Signal[] = [];
  const breed = BREED_PRICES.find((b) => b.names.includes(x.breed || ""));
  if (!breed) return { id: "price", name: "Price vs market", status: "skipped", note: "Breed not recognised", signals };
  if (l.price === undefined)
    return { id: "price", name: "Price vs market", status: "skipped", note: "No price found", signals };

  const name = (x.breed || "").replace(/\b\w/g, (ch) => ch.toUpperCase());
  const range = `Typical Australian price is about $${breed.low.toLocaleString()} to $${breed.high.toLocaleString()}`;
  if (l.price <= 50) signals.push({ points: -15, label: `$${l.price} for a ${name} is not a real price`, detail: range });
  else if (l.price < breed.low * 0.4)
    signals.push({ points: -25, label: `Price far below market for a ${name} ($${l.price})`, detail: `${range}. Too-good-to-be-true pricing is the most common pet-scam lure.` });
  else if (l.price < breed.low * 0.7)
    signals.push({ points: -10, label: `Price well below market for a ${name} ($${l.price})`, detail: range });
  else signals.push({ points: 3, label: `Price is in a plausible range for a ${name}`, detail: range });
  return { id: "price", name: "Price vs market", status: "ran", signals };
}
