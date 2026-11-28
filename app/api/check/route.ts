import { NextResponse } from "next/server";
import { BlockedError, fetchListing, isGumtreeUrl, parseListingHtml } from "../../../lib/fetchListing";
import { parsePrice } from "../../../lib/extract";
import { runChecks } from "../../../lib/score";
import { recordCheck } from "../../../lib/counter";
import type { Listing } from "../../../lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  url?: string;
  /** From the bookmarklet: page captured in the user's own browser. */
  capture?: { url?: string; title?: string; description?: string; text?: string; images?: string[]; jsonld?: string };
  /** Manual entry fallback. */
  manual?: { title?: string; description?: string; price?: string; location?: string; sellerName?: string; images?: string[] };
};

const MAX_IMAGES = 6;
const MAX_DATA_URL = 5_500_000; // ~4MB file once base64-encoded

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let listing: Listing;
  try {
    if (body.capture) {
      const c = body.capture;
      const fromLd = c.jsonld ? parseListingHtml(`<html><head><script type="application/ld+json">${c.jsonld}</script></head><body></body></html>`) : undefined;
      listing = {
        url: c.url,
        title: c.title || fromLd?.title || "",
        description: (fromLd?.description?.length || 0) > (c.description?.length || 0) ? fromLd!.description : c.description || "",
        rawText: (c.text || "").slice(0, 15000),
        priceText: fromLd?.priceText || c.text?.match(/\$\s?[\d,]{2,7}/)?.[0],
        images: cleanImages([...(c.images || []), ...(fromLd?.images || [])]),
      };
      listing.price = parsePrice(listing.priceText);
    } else if (body.manual) {
      const m = body.manual;
      listing = {
        url: body.url,
        title: m.title || "",
        description: m.description || "",
        rawText: "",
        priceText: m.price,
        price: parsePrice(m.price?.includes("$") ? m.price : m.price ? `$${m.price}` : undefined),
        location: m.location,
        sellerName: m.sellerName,
        images: cleanImages(m.images || []),
      };
    } else if (body.url) {
      if (!isGumtreeUrl(body.url))
        return NextResponse.json({ error: "Please paste a gumtree.com.au listing link." }, { status: 400 });
      listing = await fetchListing(body.url);
    } else {
      return NextResponse.json({ error: "Nothing to check" }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof BlockedError) return NextResponse.json({ blocked: true, error: e.message }, { status: 422 });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  if (!listing.title && !listing.description && !listing.rawText && !listing.images.length)
    return NextResponse.json({ error: "We couldn't find any listing details to check." }, { status: 422 });

  const report = await runChecks(listing);
  // Count only checks that produced a report; blocked or empty requests above don't count.
  const total = await recordCheck();
  return NextResponse.json({ ...report, total });
}

function cleanImages(list: string[]) {
  return [...new Set(list)]
    .filter((s) => typeof s === "string" && (/^https:\/\//.test(s) || (s.startsWith("data:image/") && s.length < MAX_DATA_URL)))
    .slice(0, MAX_IMAGES);
}
