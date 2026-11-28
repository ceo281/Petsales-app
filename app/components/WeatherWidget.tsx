"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IconKind, WeatherPayload } from "../../lib/weather/types";
import { WeatherIcon } from "./WeatherIcon";

const REFRESH_MS = 10 * 60 * 1000; // auto-update every 10 minutes
const LS_KEY = "ps-weather-loc"; // { lat, lon } | { q }
const LS_OPEN = "ps-weather-open";
const LS_MINI = "ps-weather-mini";

type Saved = { lat: number; lon: number } | { q: string } | null;
type State =
  | { kind: "loading" }
  | { kind: "ready"; data: WeatherPayload }
  | { kind: "need-location"; message?: string }
  | { kind: "hidden" };

const store = {
  get<T>(k: string): T | null {
    try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
  },
  set(k: string, v: unknown) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: fine, just not remembered */ }
  },
};

/** Card colour follows the conditions, so the widget visibly changes with the weather. */
function theme(icon: IconKind, isNight: boolean, temp: number | null) {
  if (icon === "storm") return "wx-storm";
  if (icon === "rain" || icon === "showers") return "wx-rain";
  if (isNight || icon === "moon" || icon === "partly-night") return "wx-night";
  if (temp !== null && temp >= 32) return "wx-hot";
  if (icon === "sun" || icon === "partly-day") return "wx-sunny";
  return "wx-cloudy";
}

export default function WeatherWidget() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [open, setOpen] = useState(false);
  const [mini, setMini] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const saved = useRef<Saved>(null);
  const lastFetch = useRef(0);

  const load = useCallback(async (loc: Saved, quiet = false) => {
    if (!quiet) setBusy(true);
    try {
      const qs = !loc ? "" : "q" in loc ? `?q=${encodeURIComponent(loc.q)}` : `?lat=${loc.lat}&lon=${loc.lon}`;
      const res = await fetch(`/api/weather${qs}`);
      if (res.status === 503) return setState({ kind: "hidden" });
      const json = await res.json();
      lastFetch.current = Date.now();
      if (json.error === "need-location") return setState({ kind: "need-location" });
      if (json.error === "not-found") return setState({ kind: "need-location", message: "Couldn't find that place. Try a postcode." });
      if (json.error) {
        // Keep showing the last good reading on a temporary failure.
        setState((s) => (s.kind === "ready" ? s : { kind: "need-location", message: "Weather is unavailable right now." }));
        return;
      }
      setState({ kind: "ready", data: json });
      saved.current = loc;
      if (loc) store.set(LS_KEY, loc);
      setEditing(false);
    } catch {
      setState((s) => (s.kind === "ready" ? s : { kind: "need-location", message: "Weather is unavailable right now." }));
    } finally {
      setBusy(false);
    }
  }, []);

  // First load + auto-refresh. Pauses while the tab is hidden, catches up when it's shown again.
  useEffect(() => {
    saved.current = store.get<Saved>(LS_KEY);
    setOpen(store.get<boolean>(LS_OPEN) ?? false);
    setMini(store.get<boolean>(LS_MINI) ?? false);
    load(saved.current);
    const tick = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch.current >= REFRESH_MS) load(saved.current, true);
    };
    const id = window.setInterval(tick, 60 * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [load]);

  function minimise(v: boolean) {
    setMini(v);
    store.set(LS_MINI, v);
  }

  function toggle() {
    setOpen((o) => { store.set(LS_OPEN, !o); return !o; });
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setState({ kind: "need-location", message: "Location isn't available in this browser. Enter a postcode." });
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => load({ lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 }),
      () => { setBusy(false); setEditing(true); setState((s) => (s.kind === "ready" ? s : { kind: "need-location", message: "Location was blocked. Enter a postcode instead." })); },
      { maximumAge: 30 * 60 * 1000, timeout: 10000 },
    );
  }

  function submitQuery(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) load({ q });
  }

  if (state.kind === "hidden") return null;

  const locationForm = (
    <div className="wx-loc">
      <button type="button" className="wx-btn" onClick={useMyLocation} disabled={busy}>📍 Use my location</button>
      <form onSubmit={submitQuery} className="wx-form">
        <input aria-label="Postcode or suburb" placeholder="Postcode or suburb" value={query} onChange={(e) => setQuery(e.target.value)} inputMode="text" maxLength={60} />
        <button type="submit" className="wx-btn" disabled={busy || !query.trim()}>Go</button>
      </form>
    </div>
  );

  if (mini) {
    const d = state.kind === "ready" ? state.data : null;
    return (
      <aside className={`wx-float wx-mini-wrap ${d ? theme(d.now.icon, d.now.isNight, d.now.temp) : "wx-cloudy"}`} aria-label="Local weather">
        <button type="button" className="wx-card wx-mini" onClick={() => minimise(false)} title="Show weather">
          {d ? <><WeatherIcon kind={d.now.icon} size={26} /><span>{d.now.temp ?? "–"}°</span></> : <WeatherIcon kind="partly-day" size={26} />}
        </button>
      </aside>
    );
  }

  const closeBtn = <button type="button" className="wx-x" onClick={() => minimise(true)} aria-label="Minimise weather">×</button>;

  if (state.kind === "loading") {
    return <aside className="wx-float wx-cloudy" aria-label="Local weather"><div className="wx-card wx-skel">Loading weather…</div></aside>;
  }

  if (state.kind === "need-location") {
    return (
      <aside className="wx-float wx-cloudy" aria-label="Local weather">
        {closeBtn}
        <div className="wx-card wx-setup">
          <strong>Local weather for pet owners</strong>
          {state.message && <p className="wx-small">{state.message}</p>}
          {locationForm}
        </div>
      </aside>
    );
  }

  const { data } = state;
  const t = data.today;
  const tz = data.location.timeZone;
  const dateStr = new Intl.DateTimeFormat("en-AU", { timeZone: tz, day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const updated = new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(data.fetchedAt));
  const dayName = (d: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const cls = theme(data.now.icon, data.now.isNight, data.now.temp);

  return (
    <aside className={`wx-float ${cls}`} aria-label={`Weather in ${data.location.name}`}>
      <div className="wx-cloud" aria-hidden="true" />
      {closeBtn}
      <button type="button" className="wx-card wx-main" onClick={toggle} aria-expanded={open} title={open ? "Hide details" : "Show details"}>
        <span className="wx-icon"><WeatherIcon kind={data.now.icon} size={44} /></span>
        <span className="wx-temp">{data.now.temp ?? "–"}<sup>°</sup></span>
        <span className="wx-text">
          <span className="wx-today">TODAY · {data.location.name}{data.location.state ? `, ${data.location.state}` : ""}</span>
          <span className="wx-date">{dateStr.toUpperCase()}</span>
          <span className="wx-cond">{data.now.label.toUpperCase()}{t && t.max !== null ? ` · ${t.min}°/${t.max}°` : ""}</span>
        </span>
      </button>

      {open && (
        <div className="wx-panel">
          <div className={`wx-tip wx-tip-${data.tip.tone}`}>🐾 {data.tip.text}</div>
          <dl className="wx-stats">
            <div><dt>Feels like</dt><dd>{data.now.feelsLike ?? "–"}°</dd></div>
            <div><dt>Wind</dt><dd>{data.now.windKmh ?? "–"} km/h {data.now.windDir ?? ""}</dd></div>
            <div><dt>Humidity</dt><dd>{data.now.humidity ?? "–"}%</dd></div>
            <div><dt>Rain today</dt><dd>{t ? `${t.rainMm} mm` : "–"}</dd></div>
            {t?.uvMax !== null && t?.uvMax !== undefined && <div><dt>UV max (clear sky)</dt><dd>{t.uvMax}</dd></div>}
          </dl>
          {data.next.length > 0 && (
            <ol className="wx-days">
              {data.next.map((d) => (
                <li key={d.date} title={d.label}>
                  <span>{dayName(d.date)}</span>
                  <WeatherIcon kind={d.icon} size={26} />
                  <span><b>{d.max}°</b> {d.min}°</span>
                </li>
              ))}
            </ol>
          )}
          {editing ? locationForm : (
            <button type="button" className="wx-link" onClick={() => setEditing(true)}>
              {data.via === "ip" ? "Not your area? Change location" : "Change location"}
            </button>
          )}
          <p className="wx-small">
            Updated {updated} · refreshes every 10 min · Forecast data from{" "}
            <a href="https://www.met.no/en" target="_blank" rel="noopener noreferrer">MET Norway</a> (CC BY 4.0) · Places ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
          </p>
        </div>
      )}
    </aside>
  );
}
