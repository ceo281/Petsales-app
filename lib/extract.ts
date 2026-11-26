import type { Extracted, Listing } from "./types";
import { findBreed } from "./breeds";

const STATE_PATTERNS: [Extracted["state"], RegExp][] = [
  ["VIC", /\b(vic|victoria|melbourne|geelong|ballarat|bendigo)\b/i],
  ["NSW", /\b(nsw|new south wales|sydney|newcastle|wollongong|central coast)\b/i],
  ["QLD", /\b(qld|queensland|brisbane|gold coast|sunshine coast|townsville|cairns|toowoomba)\b/i],
  ["SA", /\b(south australia|adelaide)\b|\bSA\b/],
  ["WA", /\b(western australia|perth|mandurah|bunbury)\b|\bWA\b/],
  ["TAS", /\b(tas|tasmania|hobart|launceston)\b/i],
  ["ACT", /\b(act|canberra)\b/i],
  ["NT", /\b(northern territory|darwin|alice springs)\b|\bNT\b/],
];

/** ABN checksum per the ATO algorithm. */
export function isValidAbn(abn: string) {
  const d = abn.replace(/\D/g, "").split("").map(Number);
  if (d.length !== 11) return false;
  d[0] -= 1;
  const w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  return d.reduce((s, n, i) => s + n * w[i], 0) % 89 === 0;
}

const uniq = <T,>(a: T[]) => [...new Set(a)];

export function extract(listing: Listing): Extracted {
  const text = [listing.title, listing.description, listing.rawText, listing.location, listing.sellerName]
    .filter(Boolean)
    .join("\n");

  const phones = uniq(
    (text.match(/(?:\+?61[\s-]?|0)[2-478](?:[\s-]?\d){8}/g) || []).map((p) =>
      p.replace(/[\s-]/g, "").replace(/^\+?61/, "0")
    )
  );
  const emails = uniq((text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []).map((e) => e.toLowerCase()));
  const urls = uniq(
    (text.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|au|info|biz|shop|site|online|store|pet|dog|co)(?:\.au)?\b(?:\/[^\s)]*)?/gi) || [])
      .map((u) => u.toLowerCase())
      .filter((u) => !/gumtree|ebayimg|classistatic|facebook\.com|instagram\.com|google\.|gmail|hotmail|outlook|yahoo|icloud|bigpond/.test(u))
      .filter((u) => !emails.some((e) => e.endsWith(u.replace(/^https?:\/\/(www\.)?/, ""))))
  );
  const abns = uniq(
    (text.match(/\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g) || []).map((a) => a.replace(/\s/g, "")).filter(isValidAbn)
  );

  const locText = `${listing.location || ""}\n${text}`;
  const state = STATE_PATTERNS.find(([, re]) => re.test(locText))?.[0];

  const businessName =
    text.match(/\b([A-Z][\w']+(?:[ \t]+[A-Z][\w']+){0,3}[ \t]+(?:Kennels?|Cattery|Breeders?|Puppies|Pups|Doodles|Kittens|Pets|Pty Ltd))\b/)?.[1] ||
    undefined;
  // Drop a leading verb/preposition the capitalised-words pattern can swallow ("Contact Happy Pups").
  const cleanName = businessName?.replace(/^(?:(?:Contact|Call|Text|Email|Message|From|By|At|Visit|Welcome|To|The)[ \t]+)+/, "").trim();

  return { phones, emails, urls, abns, state, breed: findBreed(text)?.name, businessName: cleanName || undefined };
}

export function parsePrice(s?: string) {
  if (!s) return undefined;
  const m = s.replace(/,/g, "").match(/\$\s?(\d{2,6})(?:\.\d{2})?/);
  return m ? Number(m[1]) : undefined;
}
