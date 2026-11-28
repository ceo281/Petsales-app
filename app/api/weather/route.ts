import { NextRequest, NextResponse } from "next/server";
import { getForecast, shape } from "../../../lib/weather/metno";
import { reversePlace, searchPlace, timeZoneFor, type Place } from "../../../lib/weather/geocode";
import type { WeatherPayload } from "../../../lib/weather/types";

/**
 * GET /api/weather
 *   ?lat=-33.87&lon=151.21   browser geolocation (rounded to ~1 km before use)
 *   ?q=3000 | ?q=Ballarat    postcode or suburb the user typed
 *   (none)                   the visitor's approximate IP location (Vercel geo headers)
 */
export async function GET(req: NextRequest) {
  if (process.env.WEATHER_ENABLED === "false") {
    return NextResponse.json({ error: "disabled" }, { status: 503 });
  }

  const p = req.nextUrl.searchParams;
  const lat = Number(p.get("lat"));
  const lon = Number(p.get("lon"));
  const q = (p.get("q") || "").trim().slice(0, 60);

  let place: Place | null = null;
  let via: WeatherPayload["via"] = "search";

  try {
    if (p.has("lat") && p.has("lon") && inAustralia(lat, lon)) {
      place = await reversePlace(round2(lat), round2(lon));
      via = "gps";
    } else if (q) {
      place = await searchPlace(q);
      if (!place) return NextResponse.json({ error: "not-found" });
    } else {
      const h = req.headers;
      const ipLat = Number(h.get("x-vercel-ip-latitude"));
      const ipLon = Number(h.get("x-vercel-ip-longitude"));
      if (h.get("x-vercel-ip-latitude") && inAustralia(ipLat, ipLon)) {
        const city = h.get("x-vercel-ip-city");
        place = {
          lat: round2(ipLat),
          lon: round2(ipLon),
          name: city ? decodeURIComponent(city) : "Your area",
          state: h.get("x-vercel-ip-country-region") || null,
        };
        via = "ip";
      }
    }
    if (!place) return NextResponse.json({ error: "need-location" });

    const tz = timeZoneFor(place.state, place.lat, place.lon);
    const data = shape(await getForecast(place.lat, place.lon, tz), { name: place.name, state: place.state }, via);
    return NextResponse.json(data, {
      // IP-based answers differ per visitor, so only the browser may cache those.
      headers: { "cache-control": via === "ip" ? "private, max-age=300" : "public, s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function inAustralia(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat < -9 && lat > -45 && lon > 112 && lon < 160;
}
