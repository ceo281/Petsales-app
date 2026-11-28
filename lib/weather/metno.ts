/**
 * Forecast data from MET Norway's Locationforecast API (global coverage,
 * ECMWF-based outside the Nordics). Free for commercial use under CC BY 4.0
 * (attribution: "Weather data from MET Norway"). Terms:
 * https://api.met.no/doc/TermsOfService — requests must carry an identifying
 * User-Agent with contact details, and results must be cached.
 *
 * Why not BOM: BOM's free feeds are "not for commercial use"; commercial
 * access needs a paid Registered User Services subscription. If PetSales
 * signs up for that, add a bom.ts that returns the same WeatherPayload.
 */
import type { DayForecast, IconKind, WeatherPayload } from "./types";

const URL_BASE = "https://api.met.no/weatherapi/locationforecast/2.0/complete";

export function userAgent() {
  return process.env.WEATHER_USER_AGENT || "petsales-weather-widget/0.1 (contact not configured)";
}

type Row = {
  time: string;
  data: {
    instant: { details: Record<string, number> };
    next_1_hours?: { summary: { symbol_code: string }; details: { precipitation_amount?: number } };
    next_6_hours?: { summary: { symbol_code: string }; details: { precipitation_amount?: number; air_temperature_max?: number; air_temperature_min?: number } };
    next_12_hours?: { summary: { symbol_code: string } };
  };
};

export async function getForecast(lat: number, lon: number, timeZone: string) {
  const res = await fetch(`${URL_BASE}?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`, {
    headers: { "user-agent": userAgent() },
    next: { revalidate: 1800 }, // MET updates about hourly; 30 min keeps us well inside their caching rules
  });
  if (!res.ok) throw new Error(`MET Norway ${res.status}`);
  const json = await res.json();
  const rows: Row[] = json?.properties?.timeseries ?? [];
  if (!rows.length) throw new Error("MET Norway: empty forecast");
  return { rows, updatedAt: (json.properties.meta?.updated_at as string) ?? null, timeZone };
}

// ---------- shaping ----------

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg?: number) => (typeof deg === "number" ? COMPASS[Math.round(deg / 22.5) % 16] : null);
const round = (n?: number) => (typeof n === "number" ? Math.round(n) : null);

/** MET symbol codes → icon + plain-English label. */
export function describe(symbol: string | undefined): { icon: IconKind; label: string; night: boolean } {
  const s = symbol ?? "cloudy";
  const night = s.endsWith("_night");
  const base = s.replace(/_(day|night|polartwilight)$/, "");
  if (base.includes("thunder")) return { icon: "storm", label: "Storms", night };
  if (base.includes("snow") || base.includes("sleet")) return { icon: "snow", label: base.includes("sleet") ? "Sleet" : "Snow", night };
  if (base.includes("showers")) return { icon: "showers", label: base.startsWith("heavy") ? "Heavy showers" : base.startsWith("light") ? "Light showers" : "Showers", night };
  if (base.includes("rain")) return { icon: "rain", label: base.startsWith("heavy") ? "Heavy rain" : base.startsWith("light") ? "Light rain" : "Rain", night };
  if (base === "fog") return { icon: "fog", label: "Fog", night };
  if (base === "cloudy") return { icon: "cloud", label: "Cloudy", night };
  if (base === "partlycloudy") return { icon: night ? "partly-night" : "partly-day", label: "Partly cloudy", night };
  if (base === "fair") return { icon: night ? "partly-night" : "partly-day", label: night ? "Mostly clear" : "Mostly sunny", night };
  return { icon: night ? "moon" : "sun", label: night ? "Clear" : "Sunny", night };
}

const SEVERITY: IconKind[] = ["sun", "moon", "partly-day", "partly-night", "cloud", "fog", "showers", "rain", "snow", "storm"];

export function shape(
  { rows, updatedAt, timeZone }: Awaited<ReturnType<typeof getForecast>>,
  location: { name: string; state: string | null },
  via: WeatherPayload["via"],
): WeatherPayload {
  const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const hourOf = new Intl.DateTimeFormat("en-AU", { timeZone, hour: "numeric", hourCycle: "h23" });

  // Start from the current hour (the API can include a row or two from the past).
  const nowMs = Date.now() - 60 * 60 * 1000;
  const future = rows.filter((r) => new Date(r.time).getTime() >= nowMs);
  const cur = future[0] ?? rows[0];

  const byDay = new Map<string, Row[]>();
  for (const r of future) {
    const d = dayOf.format(new Date(r.time));
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }

  const days: DayForecast[] = [...byDay.entries()].map(([date, rs]) => {
    // Instants alone miss the peak on the 6-hourly days, so also use each period's own min/max.
    const temps = rs
      .flatMap((r) =>
        r.data.next_1_hours
          ? [r.data.instant.details.air_temperature]
          : [r.data.instant.details.air_temperature, r.data.next_6_hours?.details.air_temperature_max, r.data.next_6_hours?.details.air_temperature_min],
      )
      .filter((t): t is number => typeof t === "number");
    const uvs = rs.map((r) => r.data.instant.details.ultraviolet_index_clear_sky).filter((t) => typeof t === "number");
    // Rain: hourly rows carry next_1_hours; the 6-hourly tail of the forecast only has next_6_hours.
    let rain = 0;
    for (const r of rs) {
      if (r.data.next_1_hours) rain += r.data.next_1_hours.details.precipitation_amount ?? 0;
      else if (r.data.next_6_hours) rain += r.data.next_6_hours.details.precipitation_amount ?? 0;
    }
    // Day icon: the worst daytime (8am–8pm) condition, so a stormy afternoon isn't shown as sunny.
    const daytime = rs.filter((r) => {
      const h = Number(hourOf.format(new Date(r.time)));
      return h >= 8 && h < 20;
    });
    const pool = (daytime.length ? daytime : rs)
      .map((r) => describe((r.data.next_1_hours ?? r.data.next_6_hours)?.summary.symbol_code?.replace("_night", "_day")))
      .sort((a, b) => SEVERITY.indexOf(b.icon) - SEVERITY.indexOf(a.icon));
    const worst = pool[0] ?? describe("cloudy");
    return {
      date,
      min: temps.length ? Math.round(Math.min(...temps)) : null,
      max: temps.length ? Math.round(Math.max(...temps)) : null,
      icon: worst.icon,
      label: worst.label,
      rainMm: Math.round(rain * 10) / 10,
      uvMax: uvs.length ? Math.round(Math.max(...uvs)) : null,
    };
  });

  const d = cur.data.instant.details;
  const nowDesc = describe((cur.data.next_1_hours ?? cur.data.next_6_hours)?.summary.symbol_code);
  const today = days[0] ?? null;

  return {
    location: { ...location, timeZone },
    now: {
      temp: round(d.air_temperature),
      feelsLike: round(d.apparent_air_temperature ?? d.air_temperature),
      humidity: round(d.relative_humidity),
      windKmh: typeof d.wind_speed === "number" ? Math.round(d.wind_speed * 3.6) : null,
      windDir: compass(d.wind_from_direction),
      icon: nowDesc.icon,
      label: nowDesc.label,
      isNight: nowDesc.night,
    },
    today,
    next: days.slice(1, 5),
    tip: petTip(round(d.apparent_air_temperature ?? d.air_temperature), today),
    modelUpdatedAt: updatedAt,
    fetchedAt: new Date().toISOString(),
    via,
  };
}

/** One line of pet-care advice for the conditions. Most serious first. */
function petTip(feels: number | null, today: DayForecast | null): WeatherPayload["tip"] {
  const max = today?.max ?? feels ?? null;
  if (max !== null && max >= 35)
    return { tone: "danger", text: `Extreme heat (${max}°). Walk dogs before 8am only, keep pets inside with water, and never leave them in the car.` };
  if (today?.icon === "storm")
    return { tone: "warn", text: "Storms forecast. Keep pets indoors, close gates, and check their microchip details are up to date." };
  if (max !== null && max >= 30)
    return { tone: "warn", text: `Hot day (${max}°). Walk early or late, and test the footpath: if it's too hot for your hand for 5 seconds, it's too hot for paws.` };
  // MET gives clear-sky UV only, which overstates on overcast/rainy days — so only warn when it's fine.
  const fine = today && ["sun", "partly-day"].includes(today.icon);
  if (fine && today.uvMax !== null && today.uvMax >= 8)
    return { tone: "warn", text: "Very high UV. Pets with pale noses and ears burn easily, so give them shade over the middle of the day." };
  if (today && today.min !== null && today.min <= 5)
    return { tone: "warn", text: `Cold night ahead (${today.min}°). Bring small and short-coated pets inside.` };
  if (today && today.rainMm >= 5)
    return { tone: "ok", text: "Wet day. Towel-dry after walks and check between paw pads." };
  return { tone: "ok", text: "Good conditions for a walk." };
}
