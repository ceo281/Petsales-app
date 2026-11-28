/*!
 * PetSales floating weather widget — drop-in for any website.
 *
 *   <script src="https://YOUR-DEPLOYMENT/weather-widget.js" defer></script>
 *
 * Optional attributes on the <script> tag:
 *   data-position="left"     float bottom-left instead of bottom-right
 *   data-start="mini"        start as the small chip instead of the full card
 *   data-api="https://..."   API origin, if not the same server as this file
 *
 * Renders inside a Shadow DOM, so the host site's CSS can't break it and
 * its CSS can't leak into the host site.
 * Forecast data: MET Norway (CC BY 4.0). Place names: © OpenStreetMap.
 * Cloud artwork: modified from a photo by Thomas Bresson, CC BY 3.0
 * (commons.wikimedia.org/wiki/File:2013-05-25_19-49-39-nuages.jpg).
 * Fonts: Oswald and Open Sans (SIL Open Font License), self-hosted.
 */
(function () {
  "use strict";
  if (window.__psWeatherLoaded) return;
  window.__psWeatherLoaded = true;

  var script = document.currentScript;
  var API = ((script && script.getAttribute("data-api")) || (script ? new URL(script.src).origin : "")).replace(/\/$/, "");
  var LEFT = script && script.getAttribute("data-position") === "left";
  var START_MINI = script && script.getAttribute("data-start") === "mini";
  var REFRESH_MS = 10 * 60 * 1000;
  var K_LOC = "ps-weather-loc", K_OPEN = "ps-weather-open", K_MINI = "ps-weather-mini";

  // @font-face only works from the main document, not inside a shadow root.
  if (!document.getElementById("psw-fonts")) {
    var ff = document.createElement("style");
    ff.id = "psw-fonts";
    ff.textContent =
      "@font-face{font-family:'PSW Oswald';src:url(" + API + "/fonts/psw-oswald.woff2) format('woff2');font-weight:200 700;font-display:swap}" +
      "@font-face{font-family:'PSW Open Sans';src:url(" + API + "/fonts/psw-opensans.woff2) format('woff2');font-weight:300 800;font-display:swap}";
    document.head.appendChild(ff);
  }

  var store = {
    get: function (k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  var dash = function (v) { return v == null ? "–" : v; };

  // ---------- icons (white line art, 48×48 grid) ----------
  function sun(cx, cy, r) {
    var s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';
    for (var i = 0; i < 8; i++) {
      var a = (i * Math.PI) / 4, c = Math.cos(a), n = Math.sin(a);
      s += '<line x1="' + (cx + c * (r + 3)) + '" y1="' + (cy + n * (r + 3)) + '" x2="' + (cx + c * (r + 6)) + '" y2="' + (cy + n * (r + 6)) + '"/>';
    }
    return s;
  }
  function moon(cx, cy, r) {
    return '<path d="M' + (cx + r * 0.3) + " " + (cy - r) + " A" + r + " " + r + " 0 1 0 " + (cx + r) + " " + (cy + r * 0.3) + " A" + r * 0.8 + " " + r * 0.8 + " 0 0 1 " + (cx + r * 0.3) + " " + (cy - r) + 'Z"/>';
  }
  var CLOUD = '<path d="M15 36h20a7 7 0 0 0 .8-13.95A10 10 0 0 0 16.6 20.6 7.7 7.7 0 0 0 15 36Z"/>';
  var SMALL = '<path d="M17 38h17a6 6 0 0 0 .7-11.96 8.5 8.5 0 0 0-16.3-1.2A6.6 6.6 0 0 0 17 38Z"/>';
  function drops(n) { var s = ""; for (var i = 0; i < n; i++) s += '<line x1="' + (18 + i * 7) + '" y1="41" x2="' + (16 + i * 7) + '" y2="46"/>'; return s; }
  function icon(kind, size) {
    var body = {
      sun: sun(24, 24, 8),
      moon: moon(22, 24, 11),
      "partly-day": sun(31, 15, 6) + SMALL,
      "partly-night": moon(30, 14, 7) + SMALL,
      cloud: CLOUD,
      fog: CLOUD + '<line x1="10" y1="41" x2="38" y2="41"/><line x1="14" y1="46" x2="34" y2="46"/>',
      showers: sun(33, 13, 5) + SMALL + drops(2),
      rain: CLOUD + drops(3),
      storm: CLOUD + '<path d="M25 36l-4 6h5l-3 6"/>',
      snow: CLOUD + '<text x="17" y="47" font-size="9" stroke="none" fill="currentColor">* * *</text>',
    }[kind] || CLOUD;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  }

  var XICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var PIN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  var PAW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="6" cy="10" rx="2.2" ry="2.8"/><ellipse cx="10" cy="6" rx="2.2" ry="2.9"/><ellipse cx="14.5" cy="6" rx="2.2" ry="2.9"/><ellipse cx="18.4" cy="10" rx="2.2" ry="2.8"/><path d="M12.2 11.5c-2.6 0-5.6 3.6-5.6 6.1 0 1.6 1.2 2.4 2.6 2.4 1.2 0 2-.7 3-.7s1.8.7 3 .7c1.4 0 2.6-.8 2.6-2.4 0-2.5-3-6.1-5.6-6.1Z"/></svg>';

  // Card colour follows the conditions.
  function theme(d) {
    var i = d.now.icon;
    if (i === "storm") return "storm";
    if (i === "rain" || i === "showers") return "rain";
    if (d.now.isNight || i === "moon" || i === "partly-night") return "night";
    if (d.now.temp != null && d.now.temp >= 32) return "hot";
    if (i === "sun" || i === "partly-day") return "sunny";
    return "cloudy";
  }

  var CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box}",
    "::selection{background:rgba(0,190,220,.35)}",
    ".f{--a:#00dcf2;--b:#139ee6;--rim:rgba(255,255,255,.22);position:fixed;bottom:16px;" + (LEFT ? "left" : "right") + ":16px;z-index:2147483000;width:372px;color:#fff;font:15px/1.4 'PSW Open Sans','Open Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}",
    /* card colour per condition; cloud tint per condition */
    ".sunny{--a:#08e0f5;--b:#16a6ea;--cf:brightness(1.18) saturate(.85)}",
    ".cloudy{--a:#00d6f0;--b:#1497e2;--cf:none}",
    ".rain{--a:#14b8e0;--b:#1d6fc0;--cf:brightness(.86) saturate(.85)}",
    ".storm{--a:#2f86b8;--b:#22396e;--cf:brightness(.58) contrast(1.15) saturate(.7)}",
    ".night{--a:#3e5bd6;--b:#1f2a7a;--cf:hue-rotate(28deg) brightness(.62) saturate(.9)}",
    ".hot{--a:#ffb54a;--b:#f2652a;--cf:hue-rotate(170deg) saturate(1.2) brightness(1.05)}",
    ".stage{position:relative;height:250px;pointer-events:none}",
    ".cloud{position:absolute;right:0;top:0;width:292px;height:auto;filter:var(--cf);transition:filter 1.2s ease;animation:drift 14s ease-in-out infinite alternate;user-select:none}",
    ".card{pointer-events:auto;position:absolute;left:0;top:92px;width:326px;height:108px;padding:12px;border:0;border-radius:30px;cursor:pointer;color:#fff;font:inherit;text-align:left;",
      "background:linear-gradient(100deg,var(--a),var(--b));",
      "box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -2px 6px rgba(0,40,90,.18),0 14px 28px -8px rgba(0,70,130,.45),0 4px 10px -4px rgba(0,70,130,.3);",
      "transition:transform .5s cubic-bezier(.16,1,.3,1),background 1.2s ease;animation:bob 7s ease-in-out infinite}",
    ".card:hover{transform:translateY(-3px)}",
    ".card:focus-visible{outline:3px solid #fff;outline-offset:3px}",
    /* the recessed inner panel with its soft bevel */
    ".panel{display:flex;align-items:center;gap:10px;height:100%;padding:0 14px 0 16px;border-radius:20px;",
      "background:linear-gradient(100deg,rgba(255,255,255,.10),rgba(255,255,255,.02) 40%,rgba(0,60,140,.10));",
      "box-shadow:inset 0 2px 4px rgba(0,50,110,.30),inset 0 -1px 0 rgba(255,255,255,.35),0 0 0 1px var(--rim)}",
    ".ic{flex:none;display:grid;place-items:center;opacity:.95}",
    ".t{flex:none;font-family:'PSW Oswald','Oswald','Arial Narrow',sans-serif;font-weight:500;font-size:58px;line-height:1;letter-spacing:-.01em;font-variant-numeric:tabular-nums;text-shadow:0 2px 6px rgba(0,60,120,.25)}",
    ".t sup{font-size:22px;font-weight:400;vertical-align:top;position:relative;top:4px;margin-left:1px}",
    ".tx{display:flex;flex-direction:column;min-width:0;flex:1;padding-left:4px}",
    ".td{font-weight:400;font-size:19px;letter-spacing:.04em;line-height:1.1;color:rgba(255,255,255,.92)}",
    ".sm{font-weight:700;font-size:11px;letter-spacing:.07em;line-height:1.45;color:rgba(255,255,255,.88);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".place{font-weight:600;font-size:11.5px;letter-spacing:.04em;color:rgba(255,255,255,.95);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}",
    ".x{pointer-events:auto;position:absolute;left:308px;top:80px;z-index:2;width:28px;height:28px;padding:0;display:grid;place-items:center;border-radius:50%;border:0;background:#fff;color:#2a3440;cursor:pointer;box-shadow:0 4px 10px -2px rgba(0,40,80,.35)}",
    ".x:focus-visible,.btn:focus-visible,.lnk:focus-visible,input:focus-visible{outline:2px solid #0aa5d6;outline-offset:2px}",
    ".p{margin-top:-34px;position:relative;padding:16px;border-radius:22px;color:#17202a;background:#fff;box-shadow:0 18px 40px -12px rgba(0,50,100,.35),0 2px 8px rgba(0,50,100,.12);max-height:min(56vh,440px);overflow:auto;scrollbar-width:thin;scrollbar-color:#b9c7d3 transparent;animation:rise .45s cubic-bezier(.16,1,.3,1)}",
    ".tip{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:14px;font-size:14px;line-height:1.45;margin-bottom:12px}",
    ".tip svg{flex:none;margin-top:1px}",
    ".ok{background:#e7f8fb;color:#0d4c5a}.warn{background:#fff3da;color:#6b4300}.danger{background:#fde6e3;color:#86200f;font-weight:600}",
    "dl{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:0 0 12px}",
    "dl div{background:#f2f6f9;border-radius:12px;padding:7px 10px}dt{font-size:11px;color:#56636f;letter-spacing:.02em}dd{margin:0;font-weight:700;font-variant-numeric:tabular-nums}",
    "ol{list-style:none;padding:0;margin:0 0 12px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px}",
    "li{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 2px;border-radius:14px;font-size:12.5px;color:#fff;background:linear-gradient(160deg,var(--a),var(--b));font-variant-numeric:tabular-nums}",
    ".fine{font-size:11px;line-height:1.5;color:#5b6773;margin:10px 0 0}.fine a{color:inherit;text-underline-offset:2px}",
    ".lnk{background:none;border:0;color:#0b7fa6;padding:0;font:inherit;font-size:13.5px;font-weight:600;text-decoration:underline;text-underline-offset:3px;cursor:pointer}",
    ".loc{display:flex;flex-direction:column;gap:8px;margin-top:10px;width:100%}",
    "form{display:flex;gap:6px;margin:0}",
    "input{flex:1;min-width:0;font:inherit;font-size:16px;padding:9px 12px;border-radius:12px;border:1px solid #cfd9e1;color:#17202a;background:#fff;caret-color:#0aa5d6}",
    "input::placeholder{color:#6b7782}",
    ".btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font:inherit;font-weight:700;font-size:14px;padding:9px 14px;border-radius:12px;border:0;background:#0b8fb8;color:#fff;cursor:pointer;transition:background .2s}",
    ".btn:hover{background:#0a7da1}.btn:disabled{opacity:.55;cursor:default}",
    ".setup{pointer-events:auto;position:absolute;left:0;top:60px;width:300px;padding:16px;border-radius:26px;color:#fff;background:linear-gradient(100deg,var(--a),var(--b));box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 14px 28px -8px rgba(0,70,130,.45)}",
    ".setup strong{font-family:'PSW Oswald','Oswald',sans-serif;font-weight:500;font-size:20px;letter-spacing:.02em}",
    ".setup .fine{color:rgba(255,255,255,.95);margin:4px 0 0}",
    ".setup .btn{background:rgba(255,255,255,.2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.6)}.setup .btn:hover{background:rgba(255,255,255,.3)}",
    ".setup input{border-color:transparent}",
    ".mini{width:auto}.chip{display:flex;align-items:center;gap:6px;padding:9px 16px 9px 12px;border:0;border-radius:999px;cursor:pointer;color:#fff;font-family:'PSW Oswald','Oswald',sans-serif;font-weight:500;font-size:22px;background:linear-gradient(100deg,var(--a),var(--b));box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 10px 22px -8px rgba(0,70,130,.5)}",
    ".loading{opacity:.9;font-size:14px;justify-content:center}",
    "@keyframes bob{0%,100%{translate:0 0}50%{translate:0 -4px}}",
    "@keyframes drift{from{translate:0 0;scale:1}to{translate:-8px 3px;scale:1.03}}",
    "@keyframes rise{from{opacity:0;translate:0 8px;filter:blur(4px)}to{opacity:1;translate:0 0;filter:blur(0)}}",
    "@media (prefers-reduced-motion:reduce){.card,.cloud,.p{animation:none}}",
    "@media (max-width:480px){.f{bottom:10px;" + (LEFT ? "left" : "right") + ":10px;width:min(330px,calc(100vw - 20px))}.stage{height:206px}.cloud{width:240px}.card{top:76px;width:calc(100% - 14px);height:98px;padding:10px}.panel{gap:8px;padding:0 12px}.ic svg{width:32px;height:32px}.x{left:auto;right:0;top:62px}.t{font-size:48px}.td{font-size:17px}.p{margin-top:-28px}}",
    "@media print{.f{display:none}}",
  ].join("\n");

  // ---------- state ----------
  var host = document.createElement("div");
  host.setAttribute("data-petsales-weather", "");
  var root = host.attachShadow({ mode: "open" });
  var state = { kind: "loading" }; // loading | ready | need | hidden
  var saved = store.get(K_LOC);
  var open = store.get(K_OPEN) || false;
  var mini = store.get(K_MINI);
  if (mini == null) mini = !!START_MINI;
  var editing = false, busy = false, lastFetch = 0;

  function load(loc, quiet) {
    if (!quiet) { busy = true; render(); }
    var qs = !loc ? "" : loc.q ? "?q=" + encodeURIComponent(loc.q) : "?lat=" + loc.lat + "&lon=" + loc.lon;
    return fetch(API + "/api/weather" + qs)
      .then(function (res) {
        if (res.status === 503) { state = { kind: "hidden" }; return; }
        return res.json().then(function (j) {
          lastFetch = Date.now();
          if (j.error === "need-location") state = { kind: "need" };
          else if (j.error === "not-found") state = { kind: "need", msg: "Couldn't find that place. Try a postcode." };
          else if (j.error) { if (state.kind !== "ready") state = { kind: "need", msg: "Weather is unavailable right now." }; }
          else { state = { kind: "ready", data: j }; saved = loc; if (loc) store.set(K_LOC, loc); editing = false; }
        });
      })
      .catch(function () { if (state.kind !== "ready") state = { kind: "need", msg: "Weather is unavailable right now." }; })
      .then(function () { busy = false; render(); });
  }

  function locForm() {
    return '<div class="loc"><button type="button" class="btn" data-act="gps"' + (busy ? " disabled" : "") + ">" + PIN + " Use my location</button>" +
      '<form data-act="search"><input name="q" aria-label="Postcode or suburb" placeholder="Postcode or suburb" maxlength="60" autocomplete="postal-code">' +
      '<button type="submit" class="btn"' + (busy ? " disabled" : "") + ">Go</button></form></div>";
  }

  function render() {
    var html = "<style>" + CSS + "</style>";
    if (state.kind === "hidden") { root.innerHTML = ""; return; }

    var CLOUD_IMG = '<img class="cloud" src="' + API + '/weather-cloud.webp" alt="" draggable="false">';
    if (mini) {
      var d0 = state.kind === "ready" ? state.data : null;
      html += '<aside class="f mini ' + (d0 ? theme(d0) : "cloudy") + '" aria-label="Local weather"><button type="button" class="chip" data-act="unmini" title="Show weather">' +
        (d0 ? icon(d0.now.icon, 28) + "<span>" + dash(d0.now.temp) + "°</span>" : icon("partly-day", 28)) + "</button></aside>";
    } else if (state.kind === "loading") {
      html += '<aside class="f cloudy" aria-label="Local weather" aria-busy="true"><div class="stage">' + CLOUD_IMG +
        '<div class="card"><div class="panel loading">Checking the sky…</div></div></div></aside>';
    } else if (state.kind === "need") {
      html += '<aside class="f cloudy" aria-label="Local weather"><div class="stage" style="height:270px">' + CLOUD_IMG +
        '<div class="setup"><strong>Weather for walkies</strong>' +
        '<p class="fine">' + esc(state.msg || "Where are you? We'll show your local forecast and a pet-care tip.") + "</p>" + locForm() + "</div>" +
        '<button type="button" class="x" data-act="mini" aria-label="Minimise weather" style="left:286px;top:48px">' + XICON + "</button></div></aside>";
    } else {
      var d = state.data, t = d.today, tz = d.location.timeZone;
      var fmt = function (o, date) { try { return new Intl.DateTimeFormat("en-AU", Object.assign({ timeZone: tz }, o)).format(date); } catch (e) { return ""; } };
      var place = esc(d.location.name) + (d.location.state ? ", " + esc(d.location.state) : "");
      html += '<aside class="f ' + theme(d) + '" aria-label="Weather in ' + esc(d.location.name) + '"><div class="stage">' + CLOUD_IMG +
        '<button type="button" class="card" data-act="toggle" aria-expanded="' + open + '" title="' + (open ? "Hide details" : "Show forecast and pet tip") + '"><span class="panel">' +
        '<span class="ic">' + icon(d.now.icon, 38) + "</span>" +
        '<span class="t">' + dash(d.now.temp) + "<sup>°</sup></span>" +
        '<span class="tx"><span class="td">TODAY</span>' +
        '<span class="sm">' + esc(fmt({ day: "numeric", month: "long", year: "numeric" }, new Date()).toUpperCase()) + "</span>" +
        '<span class="sm">' + esc(d.now.label.toUpperCase()) + "</span>" +
        '<span class="place">' + place + "</span></span></span></button>" +
        '<button type="button" class="x" data-act="mini" aria-label="Minimise weather">' + XICON + "</button></div>";
      if (open) {
        html += '<div class="p"><div class="tip ' + esc(d.tip.tone) + '">' + PAW + "<span>" + esc(d.tip.text) + "</span></div><dl>" +
          "<div><dt>Feels like</dt><dd>" + dash(d.now.feelsLike) + "°</dd></div>" +
          (t && t.max != null ? "<div><dt>Today</dt><dd>" + t.min + "° – " + t.max + "°</dd></div>" : "") +
          "<div><dt>Wind km/h</dt><dd>" + dash(d.now.windKmh) + " " + esc(d.now.windDir || "") + "</dd></div>" +
          "<div><dt>Humidity</dt><dd>" + dash(d.now.humidity) + "%</dd></div>" +
          "<div><dt>Rain today</dt><dd>" + (t ? t.rainMm + " mm" : "–") + "</dd></div>" +
          (t && t.uvMax != null ? "<div><dt>UV (clear sky)</dt><dd>" + t.uvMax + "</dd></div>" : "") + "</dl>";
        if (d.next.length) {
          html += "<ol>" + d.next.map(function (n) {
            var day = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" }).format(new Date(n.date + "T12:00:00Z"));
            return '<li title="' + esc(n.label) + '"><span>' + day + "</span>" + icon(n.icon, 26) + "<span><b>" + dash(n.max) + "°</b> " + dash(n.min) + "°</span></li>";
          }).join("") + "</ol>";
        }
        html += editing ? locForm() : '<button type="button" class="lnk" data-act="edit">' + (d.via === "ip" ? "Not your area? Change location" : "Change location") + "</button>";
        html += '<p class="fine">Updated ' + esc(fmt({ hour: "numeric", minute: "2-digit" }, new Date(d.fetchedAt))) +
          ', refreshes every 10 min. Forecast: <a href="https://www.met.no/en" target="_blank" rel="noopener noreferrer">MET Norway</a> (CC BY 4.0). Places: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>. Cloud photo: Thomas Bresson, <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>, modified.</p></div>';
      }
      html += "</aside>";
    }

    // Keep what the user was typing across re-renders.
    var prev = root.querySelector("input[name=q]");
    var typed = prev ? prev.value : "";
    root.innerHTML = html;
    var inp = root.querySelector("input[name=q]");
    if (inp && typed) inp.value = typed;
  }

  // ---------- events ----------
  root.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!el || el.tagName === "FORM") return;
    var act = el.getAttribute("data-act");
    if (act === "toggle") { open = !open; store.set(K_OPEN, open); render(); }
    else if (act === "mini") { mini = true; store.set(K_MINI, true); render(); }
    else if (act === "unmini") { mini = false; store.set(K_MINI, false); render(); }
    else if (act === "edit") { editing = true; render(); }
    else if (act === "gps") {
      if (!navigator.geolocation) { state = { kind: state.kind === "ready" ? "ready" : "need", data: state.data, msg: "Location isn't available here. Enter a postcode." }; render(); return; }
      busy = true; render();
      navigator.geolocation.getCurrentPosition(
        function (pos) { load({ lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 }); },
        function () {
          busy = false; editing = true;
          if (state.kind !== "ready") state = { kind: "need", msg: "Location was blocked. Enter a postcode instead." };
          render();
        },
        { maximumAge: 30 * 60 * 1000, timeout: 10000 }
      );
    }
  });
  root.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = (e.target.querySelector("input[name=q]") || {}).value;
    if (q && q.trim()) load({ q: q.trim() });
  });

  function tick() {
    if (document.visibilityState === "visible" && Date.now() - lastFetch >= REFRESH_MS) load(saved, true);
  }

  function start() {
    document.body.appendChild(host);
    render();
    load(saved);
    setInterval(tick, 60 * 1000);
    document.addEventListener("visibilitychange", tick);
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
