import * as cheerio from "cheerio";
import type { Listing } from "./types";
import { parsePrice } from "./extract";

export class BlockedError extends Error {}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export function isGumtreeUrl(u: string) {
  try {
    return /(^|\.)gumtree\.com\.au$/.test(new URL(u).hostname);
  } catch {
    return false;
  }
}

/**
 * Fetches a listing page server-side. Gumtree currently answers server-side
 * requests with a JavaScript "Browser Challenge" (HTTP 403). We do NOT try to
 * defeat that; we throw BlockedError and the UI falls back to the bookmarklet
 * (which reads the page in the user's own browser) or manual paste.
 */
export async function fetchListing(url: string): Promise<Listing> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html", "accept-language": "en-AU" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  const html = await res.text();
  if (res.status === 403 || res.status === 429 || /Browser Challenge|captcha|cf-chl/i.test(html.slice(0, 3000))) {
    throw new BlockedError("The listing site blocked our server from reading the page.");
  }
  if (!res.ok) throw new Error(`Listing page returned HTTP ${res.status}`);
  return parseListingHtml(html, url);
}

export function parseListingHtml(html: string, url?: string): Listing {
  const $ = cheerio.load(html);
  const meta = (p: string) => $(`meta[property="${p}"],meta[name="${p}"]`).attr("content")?.trim() || "";

  let title = meta("og:title") || $("h1").first().text().trim() || $("title").text().trim();
  let description = meta("og:description") || meta("description");
  let priceText = "";
  const images = new Set<string>();
  if (meta("og:image")) images.add(meta("og:image"));

  // JSON-LD (Product / Offer) is the most reliable structured source.
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      for (const node of [data, ...(data["@graph"] || [])].flat()) {
        if (!node || typeof node !== "object") continue;
        if (node.name && !title) title = node.name;
        if (typeof node.description === "string" && node.description.length > description.length)
          description = node.description;
        const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        if (offers?.price) priceText = `$${offers.price}`;
        const imgs = Array.isArray(node.image) ? node.image : node.image ? [node.image] : [];
        imgs.forEach((i: unknown) => typeof i === "string" && images.add(i));
      }
    } catch {
      /* ignore malformed blocks */
    }
  });

  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    if (/^https?:/.test(src) && /gumtree|ebayimg|classistatic/.test(src)) images.add(src);
  });

  const body = $("body").clone();
  body.find("script,style,noscript").empty();
  const rawText = body.text().replace(/\s+/g, " ").trim().slice(0, 15000);
  if (!priceText) priceText = rawText.match(/\$\s?[\d,]{2,7}/)?.[0] || "";

  return {
    url,
    title,
    description,
    rawText,
    priceText,
    price: parsePrice(priceText),
    images: [...images].slice(0, 8),
  };
}
