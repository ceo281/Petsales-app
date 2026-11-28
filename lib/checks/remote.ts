import type { CheckResult, Extracted, Listing, Signal } from "../types";
import { dHash, hamming, SAME_PHOTO_MAX_DISTANCE } from "../imageHash";

const LISTING_HOSTS = /gumtree\.com\.au|ebayimg|classistatic/;
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};
const SCAM_WORDS = /\b(scam|scammer|scammed|fraud|fake|ripped off|beware|warning|stolen)\b/i;

// ---------------------------------------------------------------- images ---

/** Reverse image search via Google Cloud Vision "WEB_DETECTION". */
export async function imageCheck(l: Listing): Promise<CheckResult> {
  const base = { id: "images", name: "Reverse image search" };
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!l.images.length) return { ...base, status: "skipped", note: "No photos supplied", signals: [] };
  if (!key) {
    if (process.env.SERPER_API_KEY) return lensImageCheck(l);
    return { ...base, status: "skipped", note: "Photo search not switched on yet", signals: [] };
  }

  const images = l.images.slice(0, 4);
  const requests = images.map((src) => ({
    image: src.startsWith("data:") ? { content: src.split(",")[1] } : { source: { imageUri: src } },
    features: [{ type: "WEB_DETECTION", maxResults: 15 }],
  }));

  try {
    // Key goes in a header (not the URL) so it never lands in logs or proxies' URL records.
    const res = await fetch("https://vision.googleapis.com/v1/images:annotate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ requests }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Vision API HTTP ${res.status}`);
    const data = await res.json();
    const signals: Signal[] = [];
    let anyChecked = false;

    data.responses?.forEach((r: any, i: number) => {
      if (r.error) return;
      anyChecked = true;
      const pages: { url: string; pageTitle?: string; fullMatchingImages?: unknown[] }[] =
        r.webDetection?.pagesWithMatchingImages || [];
      const elsewhere = pages.filter((p) => !LISTING_HOSTS.test(p.url));
      const full = elsewhere.filter((p) => p.fullMatchingImages?.length);
      const links = elsewhere.slice(0, 6).map((p) => ({ title: p.pageTitle?.replace(/<[^>]+>/g, "") || host(p.url), url: p.url }));
      if (full.length >= 1) {
        signals.push({
          points: full.length >= 3 ? -30 : -22,
          label: `Photo ${i + 1} appears on ${full.length} other website${full.length > 1 ? "s" : ""}`,
          detail: "Scammers usually steal photos from real breeders. Check whether these pages belong to the same seller.",
          links,
        });
      } else if (elsewhere.length) {
        signals.push({ points: -6, label: `Photo ${i + 1} has partial matches online`, detail: "Could be a cropped/edited copy. Review the links.", links });
      }
    });

    if (!anyChecked) return { ...base, status: "error", note: "Vision could not read any of the photos", signals };
    if (!signals.length) signals.push({ points: 6, label: "No copies of the photos found elsewhere online" });
    return { ...base, status: "ran", signals };
  } catch (e) {
    return { ...base, status: "error", note: (e as Error).message, signals: [] };
  }
}

// ------------------------------------------------------------ web search ---

type SearchResult = { title: string; url: string; description?: string };

/** Google web search via Serper.dev (https://serper.dev), Australian results. */
async function search(q: string): Promise<SearchResult[]> {
  const key = process.env.SERPER_API_KEY!;
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ q, gl: "au", hl: "en", num: 10 }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Serper search HTTP ${res.status}`);
  const data = await res.json();
  return (data.organic || []).map((r: any) => ({
    title: String(r.title || ""),
    url: String(r.link || ""),
    description: String(r.snippet || ""),
  }));
}

/**
 * Google Lens via Serper.dev: where else does this photo appear?
 * Only works for photos with a public https URL (not uploaded files).
 * Verified response shape: { organic: [{ title, source, link, imageUrl, thumbnailUrl }] }.
 * Lens returns visually SIMILAR images, so every match is confirmed as the same
 * photo with a perceptual hash before it counts (see lensImageCheck).
 */
type LensResult = SearchResult & { thumb?: string };
async function lens(imageUrl: string): Promise<LensResult[]> {
  const key = process.env.SERPER_API_KEY!;
  const res = await fetch("https://google.serper.dev/lens", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ url: imageUrl, gl: "au", hl: "en" }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Serper Lens HTTP ${res.status}`);
  const data = await res.json();
  const rows: any[] = [...(data.organic || []), ...(data.visualMatches || []), ...(data.visual_matches || []), ...(data.images || [])];
  return rows
    .map((r) => ({
      title: String(r.title || r.source || ""),
      url: String(r.link || r.url || ""),
      description: String(r.snippet || ""),
      thumb: String(r.thumbnailUrl || r.imageUrl || ""),
    }))
    .filter((r) => r.url.startsWith("http"));
}

/** Reverse image search through Serper's Google Lens, used when Vision isn't configured. */
async function lensImageCheck(l: Listing): Promise<CheckResult> {
  const base = { id: "images", name: "Reverse image search" };
  const urls = l.images.filter((s) => s.startsWith("https://")).slice(0, 4);
  if (!urls.length)
    return { ...base, status: "skipped", note: "Photo search needs the ad's photo links (use the bookmark or a Gumtree link)", signals: [] };
  const signals: Signal[] = [];
  const results = await Promise.allSettled(urls.map(lens));
  await Promise.all(
    results.map(async (r, i) => {
      if (r.status !== "fulfilled") return;
      const original = await dHash(urls[i]);
      if (original === null) return;
      // Confirm each candidate is the SAME photo, not just a similar-looking pet.
      const candidates = r.value.filter((p) => !LISTING_HOSTS.test(p.url) && p.thumb).slice(0, 15);
      const checked = await Promise.all(
        candidates.map(async (p) => {
          const h = await dHash(p.thumb!);
          return h !== null && hamming(original, h) <= SAME_PHOTO_MAX_DISTANCE ? p : null;
        })
      );
      const copies = checked.filter((p): p is LensResult => p !== null);
      const sites = new Set(copies.map((p) => host(p.url)));
      if (sites.size >= 1)
        signals.push({
          points: sites.size >= 3 ? -30 : -22,
          label: `Photo ${i + 1} appears on ${sites.size} other website${sites.size > 1 ? "s" : ""}`,
          detail: "The same photo is on these pages. Scammers usually steal photos from real breeders, so check whether these pages belong to the same seller.",
          links: copies.slice(0, 6).map((p) => ({ title: p.title || host(p.url), url: p.url })),
        });
    })
  );
  if (results.every((r) => r.status === "rejected"))
    return { ...base, status: "error", note: String((results[0] as PromiseRejectedResult).reason?.message || "Photo search failed"), signals };
  if (!signals.length) signals.push({ points: 6, label: "No copies of the photos found elsewhere online" });
  return { ...base, status: "ran", signals };
}

/** Pick a distinctive sentence from the description to detect copy-paste ads. */
function fingerprintSentence(desc: string) {
  const sentences = desc
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/["“”]/g, ""))
    .filter((s) => s.split(/\s+/).length >= 8 && !/\$|\d{6,}|@/.test(s));
  sentences.sort((a, b) => b.length - a.length);
  return sentences[0]?.split(/\s+/).slice(0, 14).join(" ");
}

export async function webCheck(l: Listing, x: Extracted): Promise<CheckResult> {
  const base = { id: "web", name: "Online text, name & phone search" };
  if (!process.env.SERPER_API_KEY)
    return { ...base, status: "skipped", note: "Web search not switched on yet", signals: [] };

  const signals: Signal[] = [];
  const jobs: Promise<void>[] = [];

  const sentence = fingerprintSentence(l.description || l.rawText);
  if (sentence) {
    jobs.push(
      search(`"${sentence}"`).then((rs) => {
        const other = rs.filter((r) => !LISTING_HOSTS.test(r.url) && (!l.url || !r.url.startsWith(l.url)));
        if (other.length >= 2)
          signals.push({
            points: -18,
            label: `Ad wording appears on ${other.length} other web pages`,
            detail: `Copy-pasted text is a strong sign of a scam template. Searched: "${sentence}"`,
            links: other.slice(0, 5).map((r) => ({ title: r.title || host(r.url), url: r.url })),
          });
        else if (other.length === 1)
          signals.push({ points: -5, label: "Ad wording found on one other page", links: [{ title: other[0].title, url: other[0].url }] });
      })
    );
  }

  const identifiers = [...x.phones, ...x.emails].slice(0, 4);
  for (const id of identifiers) {
    jobs.push(
      search(`"${id}"`).then((rs) => {
        const scammy = rs.filter((r) => SCAM_WORDS.test(`${r.title} ${r.description}`));
        if (scammy.length)
          signals.push({
            points: -30,
            label: `${id} appears in online scam reports/warnings`,
            detail: "Read these pages yourself. The match may be coincidental, but treat it seriously.",
            links: scammy.slice(0, 5).map((r) => ({ title: r.title, url: r.url })),
          });
        else if (rs.filter((r) => !LISTING_HOSTS.test(r.url)).length >= 3)
          signals.push({
            points: 0,
            label: `${id} is used on other sites`,
            detail: "Check these are the same seller and breed.",
            links: rs.slice(0, 5).map((r) => ({ title: r.title, url: r.url })),
          });
      })
    );
  }

  const name = x.businessName || l.sellerName;
  if (name && name.length >= 4) {
    jobs.push(
      search(`"${name}" (scam OR fraud OR fake OR "ripped off")`).then((rs) => {
        const scammy = rs.filter((r) => SCAM_WORDS.test(`${r.title} ${r.description}`) && r.title.toLowerCase().includes(name.toLowerCase().split(" ")[0]));
        if (scammy.length)
          signals.push({
            // Names collide — weight lower than a phone/email match and never call it proof.
            points: x.businessName ? -15 : -6,
            label: `Search results mention "${name}" alongside scam/fraud terms`,
            detail: "Names are often shared by unrelated people or businesses. Read the pages before drawing conclusions.",
            links: scammy.slice(0, 5).map((r) => ({ title: r.title, url: r.url })),
          });
      })
    );
  }

  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  if (failed.length === results.length && results.length)
    return { ...base, status: "error", note: String(failed[0].reason?.message || failed[0].reason), signals };
  if (!jobs.length) return { ...base, status: "skipped", note: "Nothing distinctive to search for", signals };
  if (!signals.length) signals.push({ points: 4, label: "No scam reports or copy-paste matches found online" });
  return { ...base, status: "ran", signals };
}

// ---------------------------------------------------------------- social ---

export async function socialCheck(l: Listing, x: Extracted): Promise<CheckResult> {
  const base = { id: "social", name: "Facebook & Instagram presence" };
  const terms = [x.businessName, ...x.phones.slice(0, 1)].filter(Boolean) as string[];
  if (!terms.length) return { ...base, status: "na", note: "No business name or phone to look up", signals: [] };
  if (!process.env.SERPER_API_KEY)
    return { ...base, status: "skipped", note: "Web search not switched on yet", signals: [] };

  try {
    const q = terms.map((t) => `"${t}"`).join(" OR ");
    const [fb, ig] = await Promise.all([search(`${q} site:facebook.com`), search(`${q} site:instagram.com`)]);
    // Keep only direct Facebook / Instagram links (search can return Google redirect URLs).
    const links = [...fb, ...ig]
      .filter((r) => /(^|\.)(facebook|instagram)\.com$/.test(host(r.url)))
      .slice(0, 8)
      .map((r) => ({ title: r.title || host(r.url), url: r.url }));
    const signals: Signal[] = [];
    if (links.length)
      signals.push({
        // Presence is weak evidence: fake pages are cheap. Absence matters more for a claimed business.
        points: 2,
        label: `Found ${links.length} Facebook/Instagram result${links.length > 1 ? "s" : ""}`,
        detail: "Open them: look for page age, real reviews/comments, past litters, and consistent photos. Brand-new pages with no history are a warning sign.",
        links,
      });
    else if (x.businessName)
      signals.push({ points: -6, label: `No Facebook or Instagram presence found for "${x.businessName}"`, detail: "Established breeders usually have some social footprint." });
    return { ...base, status: "ran", signals };
  } catch (e) {
    return { ...base, status: "error", note: (e as Error).message, signals: [] };
  }
}

// ---------------------------------------------------------------- domain ---

/** Website age via RDAP (free, no key). Scam breeder sites are usually weeks old. */
export async function domainCheck(x: Extracted): Promise<CheckResult> {
  const base = { id: "domain", name: "Seller website age" };
  if (!x.urls.length) return { ...base, status: "na", note: "No website in the ad", signals: [] };
  const signals: Signal[] = [];
  for (const u of x.urls.slice(0, 2)) {
    const domain = host(u.startsWith("http") ? u : `https://${u}`);
    try {
      const res = await fetch(`https://rdap.org/domain/${domain}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json();
      const reg = data.events?.find((e: any) => e.eventAction === "registration")?.eventDate;
      if (!reg) continue;
      const days = Math.round((Date.now() - new Date(reg).getTime()) / 86400000);
      const when = new Date(reg).toLocaleDateString("en-AU");
      if (days < 180)
        signals.push({ points: -20, label: `${domain} was registered only ${days} days ago`, detail: `Registered ${when}. Fake breeder websites are typically brand new.` });
      else if (days > 730) signals.push({ points: 4, label: `${domain} has existed since ${when}` });
      else signals.push({ points: 0, label: `${domain} registered ${when}` });
    } catch {
      /* .au domains may not be in RDAP bootstrap; ignore */
    }
  }
  return { ...base, status: signals.length ? "ran" : "error", note: signals.length ? undefined : "Couldn't look up registration date", signals };
}

// ------------------------------------------------------------------- ABN ---

export async function abnCheck(x: Extracted): Promise<CheckResult> {
  const base = { id: "abn", name: "ABN / business register" };
  const guid = process.env.ABR_GUID;
  if (!x.abns.length && !x.businessName)
    return { ...base, status: "na", note: "No ABN or business name in the ad", signals: [] };
  if (!guid) return { ...base, status: "skipped", note: "ABR_GUID not set", signals: [] };

  const parseJsonp = (t: string) => JSON.parse(t.replace(/^[^(]*\(/, "").replace(/\);?\s*$/, ""));
  const signals: Signal[] = [];
  try {
    for (const abn of x.abns.slice(0, 2)) {
      const t = await (await fetch(`https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&guid=${guid}`)).text();
      const d = parseJsonp(t);
      const link = [{ title: "ABN Lookup record", url: `https://abr.business.gov.au/ABN/View?abn=${abn}` }];
      if (!d.Abn) signals.push({ points: -15, label: `ABN ${abn} not found on the register`, links: link });
      else if (d.AbnStatus !== "Active")
        signals.push({ points: -15, label: `ABN ${abn} is ${d.AbnStatus} (${d.EntityName})`, links: link });
      else signals.push({ points: 5, label: `ABN ${abn} is active: ${d.EntityName}`, detail: "Check this name matches the seller.", links: link });
    }
    if (!x.abns.length && x.businessName) {
      const t = await (await fetch(`https://abr.business.gov.au/json/MatchingNames.aspx?name=${encodeURIComponent(x.businessName)}&maxResults=5&guid=${guid}`)).text();
      const d = parseJsonp(t);
      const names: any[] = d.Names || [];
      const exact = names.find((n) => String(n.Name).toLowerCase() === x.businessName!.toLowerCase());
      if (exact)
        signals.push({ points: 3, label: `"${x.businessName}" is a registered business name`, links: [{ title: "ABN Lookup", url: `https://abr.business.gov.au/ABN/View?abn=${exact.Abn}` }] });
      else
        signals.push({ points: -4, label: `"${x.businessName}" isn't a registered business name`, detail: "Hobby breeders may not have one. Ask for their breeder ID instead." });
    }
    return { ...base, status: "ran", signals };
  } catch (e) {
    return { ...base, status: "error", note: (e as Error).message, signals };
  }
}
