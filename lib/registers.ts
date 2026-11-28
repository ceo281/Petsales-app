/**
 * Live breeder-number lookups against state registers that allow it.
 *
 * VIC Pet Exchange Register and QLD Dog Breeder Register expose public search
 * forms with no CAPTCHA, so the server performs the same single search a
 * person would. NSW requires a reCAPTCHA token on every search and is never
 * queried automatically. SA (Dogs and Cats Online) refuses requests from
 * outside Australia; it needs an Australian-hosted server and is not wired yet.
 *
 * Etiquette: one request per lookup, results cached for 12 hours, short
 * timeouts, no retries.
 */

export type RegisterResult =
  | { state: "VIC" | "QLD"; status: "found"; detail?: string }
  | { state: "VIC" | "QLD"; status: "notfound" }
  | { state: "VIC" | "QLD"; status: "error"; reason: string };

const UA = "PetSales Scam Checker (+https://petsales.com.au)";
const TTL = 12 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: RegisterResult }>();

function cookieHeader(res: Response) {
  const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function lookupVic(number: string): Promise<RegisterResult> {
  const page = await fetch("https://per.animalwelfare.vic.gov.au/search", {
    headers: { "user-agent": UA, accept: "text/html" },
    signal: AbortSignal.timeout(10000),
  });
  const html = await page.text();
  const token = html.match(/name="csrf-token" content="([^"]+)"/)?.[1];
  if (!token) return { state: "VIC", status: "error", reason: "Register page changed" };
  const res = await fetch("https://per.animalwelfare.vic.gov.au/search", {
    method: "POST",
    headers: {
      "user-agent": UA,
      accept: "application/json",
      "content-type": "application/json",
      "x-csrf-token": token,
      cookie: cookieHeader(page),
    },
    body: JSON.stringify({ query: number }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return { state: "VIC", status: "error", reason: `Register returned ${res.status}` };
  const data = await res.json();
  if (data.status === "notfound") return { state: "VIC", status: "notfound" };
  const acct = Array.isArray(data.account_data) ? data.account_data[0] : data.account_data;
  const council = acct?.city_council || acct?.council;
  const st = acct?.status ? ` Status: ${acct.status}.` : "";
  return { state: "VIC", status: "found", detail: `${council ? `Council: ${council}.` : ""}${st}`.trim() || undefined };
}

async function lookupQld(number: string): Promise<RegisterResult> {
  const URL = "https://qdbr.dpi.qld.gov.au/supply-number-search/";
  const page = await fetch(URL, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) });
  const html = await page.text();
  const form = html.slice(html.indexOf('id="liquid_form"'));
  const fields = new URLSearchParams();
  let searchKey = "";
  for (const tag of form.match(/<input[^>]*>/g) || []) {
    const name = tag.match(/name="([^"]+)"/)?.[1];
    const type = tag.match(/type="([^"]+)"/)?.[1];
    if (!name || name === "q" || type === "button" || type === "submit") continue;
    const value = (tag.match(/value="([^"]*)"/)?.[1] || "").replace(/&#32;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    if (name.endsWith("dlg_searchfieldvalue")) searchKey = name;
    fields.set(name, value);
  }
  const button = form.match(/name="([^"]+InsertButton)"/)?.[1];
  if (!searchKey || !button) return { state: "QLD", status: "error", reason: "Register page changed" };
  fields.set(searchKey, number);
  fields.set("__EVENTTARGET", button);
  const res = await fetch(URL, {
    method: "POST",
    headers: { "user-agent": UA, "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(page) },
    body: fields.toString(),
    signal: AbortSignal.timeout(12000),
  });
  const out = await res.text();
  const decode = (s: string) => s.replace(/&#32;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  const result = decode(out.match(/id="dlg_result"[^>]*value="([^"]*)"/)?.[1] || out.match(/value="([^"]*)"[^>]*id="dlg_result"/)?.[1] || "");
  const display = decode(out.match(/id="dlg_displaydata"[^>]*>([^<]*)</)?.[1] || "").trim();
  if (!result) return { state: "QLD", status: "error", reason: "No result returned" };
  if (/not\s*found|invalid/i.test(result)) return { state: "QLD", status: "notfound" };
  return { state: "QLD", status: "found", detail: [result, display].filter(Boolean).join(". ").slice(0, 300) };
}

export async function lookupBreederNumber(state: "VIC" | "QLD", number: string): Promise<RegisterResult> {
  const key = `${state}:${number}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  let value: RegisterResult;
  try {
    value = state === "VIC" ? await lookupVic(number) : await lookupQld(number);
  } catch (e) {
    value = { state, status: "error", reason: (e as Error).name === "TimeoutError" ? "Register took too long to answer" : "Register unavailable" };
  }
  if (value.status !== "error") cache.set(key, { at: Date.now(), value });
  return value;
}
