/**
 * Place names and postcode search via OpenStreetMap Nominatim.
 * Data © OpenStreetMap contributors (ODbL). Usage policy: max 1 request/second,
 * identifying User-Agent, cache results. Coordinates are rounded to ~1 km and
 * results cached for 30 days, so repeat visitors don't hit it. If traffic
 * grows past that, move to a paid geocoder or a bundled AU postcode list.
 */
import { userAgent } from "./metno";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const MONTH = 60 * 60 * 24 * 30;

export type Place = { lat: number; lon: number; name: string; state: string | null };

const STATE_ABBR: Record<string, string> = {
  "New South Wales": "NSW", Victoria: "VIC", Queensland: "QLD", "South Australia": "SA",
  "Western Australia": "WA", Tasmania: "TAS", "Northern Territory": "NT", "Australian Capital Territory": "ACT",
};

const TZ: Record<string, string> = {
  NSW: "Australia/Sydney", ACT: "Australia/Sydney", VIC: "Australia/Melbourne", TAS: "Australia/Hobart",
  QLD: "Australia/Brisbane", SA: "Australia/Adelaide", NT: "Australia/Darwin", WA: "Australia/Perth",
};

/** Time zone from state; falls back to a longitude guess (covers a missing state). */
export function timeZoneFor(state: string | null, lat: number, lon: number) {
  if (state && TZ[state]) return TZ[state];
  if (lon < 129) return "Australia/Perth";
  if (lon < 138) return lat > -26 ? "Australia/Darwin" : "Australia/Adelaide"; // NT has no daylight saving
  if (lat > -29 && lon < 154) return "Australia/Brisbane"; // QLD has no daylight saving
  return "Australia/Sydney";
}

function toPlace(r: any): Place | null {
  if (!r?.lat || !r?.lon) return null;
  const a = r.address ?? {};
  const name = a.suburb || a.town || a.village || a.city_district || a.city || a.hamlet || a.municipality || (r.addresstype === "postcode" ? null : r.name) || "Your area";
  // NT and ACT come back as "territory", not "state"; the ISO code covers both.
  const iso = String(a["ISO3166-2-lvl4"] ?? "");
  const state = iso.startsWith("AU-") ? iso.slice(3) : STATE_ABBR[a.state ?? a.territory] ?? null;
  return { lat: Number(r.lat), lon: Number(r.lon), name, state };
}

async function nominatim(path: string) {
  const res = await fetch(`${NOMINATIM}${path}`, {
    headers: { "user-agent": userAgent(), "accept-language": "en-AU" },
    next: { revalidate: MONTH },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

/** Postcode or suburb typed by the user. Australia only. */
export async function searchPlace(q: string): Promise<Place | null> {
  const r = await nominatim(`/search?q=${encodeURIComponent(q)}&countrycodes=au&format=jsonv2&limit=1&addressdetails=1`);
  return toPlace(r?.[0]);
}

export async function reversePlace(lat: number, lon: number): Promise<Place> {
  try {
    const r = await nominatim(`/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=14&addressdetails=1`);
    const p = toPlace(r);
    if (p) return { ...p, lat, lon };
  } catch {
    /* name is nice-to-have; the forecast still works without it */
  }
  return { lat, lon, name: "Your area", state: null };
}
