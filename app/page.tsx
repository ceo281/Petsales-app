"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookmarkSimple,
  CheckCircle,
  Buildings,
  ChatCenteredText,
  CircleNotch,
  ClipboardText,
  CurrencyDollar,
  Eye,
  HandCoins,
  IdentificationCard,
  Images,
  InstagramLogo,
  LinkSimple,
  LockSimple,
  Phone,
  Truck,
  UploadSimple,
  Megaphone,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import type { Report, Signal } from "../lib/types";
import { ReportSkeleton, ReportView, ScoreHeader, SignalRow } from "./components/ReportView";

type Mode = "url" | "manual";

/**
 * Runs on the Gumtree page in the user's own browser, captures what they can
 * already see, and opens the checker with it in the URL hash. Nothing is sent
 * anywhere until the checker page posts it to our API.
 */
function bookmarkletCode(origin: string) {
  const js = `(()=>{const m=n=>(document.querySelector('meta[property="'+n+'"],meta[name="'+n+'"]')||{}).content||'';const imgs=[...new Set([...document.images].filter(i=>i.naturalWidth>=300).map(i=>i.currentSrc||i.src).filter(u=>u.startsWith('https://')))].slice(0,8);const ld=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>s.textContent).join('\\n').slice(0,20000);const d={url:location.href,title:m('og:title')||document.title,description:m('og:description'),text:document.body.innerText.slice(0,12000),images:imgs,jsonld:ld};const b=btoa(unescape(encodeURIComponent(JSON.stringify(d))));window.open('${origin}/#d='+encodeURIComponent(b),'_blank');})()`;
  return `javascript:${encodeURIComponent(js)}`;
}

function readFileAsDataUrl(f: File) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

const isGumtree = (u: string) => {
  try {
    return /(^|\.)gumtree\.com\.au$/.test(new URL(u.trim()).hostname);
  } catch {
    return false;
  }
};

// Illustrative example for the hero preview. Not a real seller.
const EXAMPLE = {
  score: 14,
  band: "high-risk" as const,
  confidence: 0.86,
  listing: { title: "French Bulldog puppies ready now", priceText: "$650", imageCount: 4 },
};
const EXAMPLE_SIGNALS: Signal[] = [
  { points: -30, label: "Photo 1 appears on 4 other websites", detail: "Scammers usually reuse photos stolen from real breeders." },
  { points: -25, label: "Price far below market for a French Bulldog" },
  { points: -20, label: "Offers pet transport instead of pick-up" },
];

// Every item here maps to a rule in lib/checks. Keep this list in step with the code.
const AREAS: { icon: typeof Phone; title: string; body: string; items: string[]; key?: boolean }[] = [
  {
    icon: ChatCenteredText,
    title: "Scam wording",
    body: "The scripts scammers reuse, and the signs of a genuine breeder.",
    items: [
      "Shipping or pet transport", "Gift cards, crypto, Western Union", "Deposit before viewing", "Bank transfer or PayID up front",
      "Seller can't meet", "Relocation or sob story", "WhatsApp or text only", "US kennel club papers", "Urgency pressure",
      "'Free' pet lure", "'Teacup' marketing", "Crate, insurance or quarantine fees",
      "Invites you to visit", "Breed club membership", "Health testing",
    ],
  },
  {
    icon: IdentificationCard,
    title: "Breeder and microchip numbers",
    body: "Required by law in VIC, NSW, QLD and SA ads. We look the number up for you where the state allows it.",
    items: ["Number shown in the ad", "Missing where the law requires it", "Looked up on the VIC register", "Looked up on the QLD register", "NSW number format", "Microchip number"],
  },
  {
    icon: CurrencyDollar,
    title: "Price against the market",
    body: "Too cheap for the breed is the most common lure. Compared with typical Australian prices for about 30 breeds.",
    items: ["Not a real price", "Far below market", "Well below market", "Plausible price"],
  },
  {
    icon: Images,
    title: "Stolen photos",
    body: "Reverse image search on up to four photos from the ad.",
    items: ["Same photo on other websites", "Edited or cropped copies"],
    key: true,
  },
  {
    icon: ClipboardText,
    title: "Copied ad wording",
    body: "Scam templates get pasted word for word across many ads.",
    items: ["Ad text found on other pages"],
    key: true,
  },
  {
    icon: Phone,
    title: "Phone, email and seller name",
    body: "Searched against scam reports and warnings published online.",
    items: ["Phone in scam reports", "Email in scam reports", "Phone or email reused on other sites", "Name next to scam or fraud reports"],
    key: true,
  },
  {
    icon: InstagramLogo,
    title: "Facebook and Instagram",
    body: "Links to the seller's pages so you can check their history and past litters.",
    items: ["Social pages found", "No social presence for a named business"],
    key: true,
  },
  {
    icon: Buildings,
    title: "Website and ABN",
    body: "Fake breeder websites are usually weeks old. ABNs are checked against the government register.",
    items: ["Website age", "ABN number valid", "ABN active or cancelled", "Business name registered"],
  },
];
const CHECK_COUNT = AREAS.reduce((n, a) => n + a.items.length, 0);

const REGISTERS = [
  { state: "VIC", name: "Pet Exchange Register", status: "Checked live", live: true, note: "We search the source number and show the result in your report." },
  { state: "QLD", name: "Dog Breeder Register", status: "Checked live", live: true, note: "We search the supply number and show the result in your report." },
  { state: "SA", name: "Dogs and Cats Online", status: "Coming soon", live: false, note: "The register only answers Australian servers. Live once we move to Sydney hosting." },
  { state: "NSW", name: "NSW Pet Registry", status: "Format check", live: false, note: "NSW requires a CAPTCHA on every search, so we check the number's format and link you to the registry." },
];

const RULES = [
  { icon: Eye, title: "See the pet in person", body: "Or a live video call where the seller says your name and shows the pet with its mum." },
  { icon: HandCoins, title: "No deposits to strangers", body: "Never pay by bank transfer, PayID, gift card or crypto before you've met. Banks never charge you to receive a PayID payment." },
  { icon: Truck, title: "No shipping, no fees", body: "Pet transport, crate, insurance or quarantine fees are how the scam escalates." },
  { icon: IdentificationCard, title: "Verify the numbers", body: "We check VIC and QLD numbers for you. Elsewhere, look the number up and check the microchip is in the seller's name." },
  { icon: Megaphone, title: "Report it fast", body: "Tell Scamwatch and Gumtree, and call your bank straight away if you've paid." },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [manual, setManual] = useState({ title: "", description: "", price: "", location: "", sellerName: "" });
  const [descError, setDescError] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [origin, setOrigin] = useState("");
  const [shared, setShared] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    // Arrived from the phone's Share menu (Web Share Target). Android puts the
    // link in `url` or inside `text`; the title comes through as `title`.
    const q = new URLSearchParams(window.location.search);
    if (q.has("url") || q.has("text") || q.has("title")) {
      const raw = `${q.get("url") || ""} ${q.get("text") || ""}`;
      const link = raw.match(/https?:\/\/[^\s]*gumtree\.com\.au[^\s]*/i)?.[0];
      // Gumtree titles look like "Cavoodle puppies | Dogs & Puppies | Gumtree Australia".
      const title = (q.get("title") || "").split(" | ")[0].replace(/\s*-\s*Gumtree.*$/i, "").trim();
      history.replaceState(null, "", window.location.pathname);
      if (link) {
        setUrl(link);
        setShared(true);
        setMode("manual");
        if (title) setManual((m) => ({ ...m, title }));
        requestAnimationFrame(() => document.getElementById("d")?.focus());
      } else {
        setError("That share didn't include a Gumtree link. Open the ad in Gumtree and share it again.");
      }
      return;
    }

    const m = window.location.hash.match(/^#d=(.+)$/);
    if (!m) return;
    try {
      const capture = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      history.replaceState(null, "", window.location.pathname);
      setUrl(capture.url || "");
      void check({ capture });
    } catch {
      setError("We couldn't read the captured ad. Open the Gumtree ad and click the bookmark again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check(body: object) {
    setLoading(true);
    setError("");
    setBlocked(false);
    setReport(null);
    requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    try {
      const res = await fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (data.blocked) {
        setBlocked(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || "The check didn't finish. Please try again.");
      setReport(data);
    } catch (e) {
      setError((e as Error).message || "The check didn't finish. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return setUrlError("Paste the link to the Gumtree ad.");
    if (!isGumtree(url)) return setUrlError("That doesn't look like a gumtree.com.au link. Copy it from your browser's address bar.");
    setUrlError("");
    void check({ url: url.trim() });
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (manual.description.trim().length < 40) return setDescError("Paste the full description from the ad. A sentence or two isn't enough to check.");
    setDescError("");
    void check({ url: url.trim() || undefined, manual: { ...manual, images } });
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const picked = [...files].filter((f) => f.type.startsWith("image/") && f.size < 4_000_000).slice(0, 6 - images.length);
    const urls = await Promise.all(picked.map(readFileAsDataUrl));
    setImages((prev) => [...prev, ...urls].slice(0, 6));
  }

  const bm = useMemo(() => (origin ? bookmarkletCode(origin) : "#"), [origin]);
  const showResults = loading || report || blocked || error;

  return (
    <>
      <a className="skip" href="#main">Skip to the checker</a>

      <header className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="/" aria-label="PetSales Scam Checker home">
            <img src="/logo@720.png" alt="PetSales.com.au" width={150} height={65} style={{ width: 150, height: "auto", borderRadius: 0 }} />
            <span className="brand-sub">Scam Checker</span>
          </a>
          <a className="nav-link" href="#how">How it works</a>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <h1>
                Scam check <span className="hl">that pet.</span>
              </h1>
              <p className="lede">
                Paste the Gumtree link before you pay a cent. We run {CHECK_COUNT} checks and score the ad out of 100.
              </p>

              <div className="checker">
                {shared && mode === "manual" && (
                  <div className="shared-note" role="status">
                    <CheckCircle size={20} weight="fill" aria-hidden="true" />
                    <span>
                      <strong>Got the ad link.</strong> Gumtree doesn&apos;t let us read the ad for you, so copy the description from the ad and paste it below. Add the photos too if you can.
                    </span>
                  </div>
                )}
                {mode === "url" ? (
                  <form onSubmit={submitUrl} noValidate>
                    <div className="field">
                      <label className="label" htmlFor="url">Gumtree listing link</label>
                      <div className="url-row">
                        <input
                          id="url" className="input" type="url" inputMode="url" autoComplete="off"
                          placeholder="https://www.gumtree.com.au/s-ad/..."
                          value={url} onChange={(e) => setUrl(e.target.value)}
                          aria-invalid={!!urlError} aria-describedby={urlError ? "url-err" : "url-help"}
                        />
                        <button className="btn btn-primary" disabled={loading}>
                          {loading ? <CircleNotch className="spin" size={20} aria-hidden="true" /> : <LinkSimple size={20} weight="bold" aria-hidden="true" />}
                          {loading ? "Checking" : "Check listing"}
                        </button>
                      </div>
                      {urlError ? (
                        <p className="field-err" id="url-err" role="alert">{urlError}</p>
                      ) : (
                        <p className="help" id="url-help">Copy it from the address bar while you&apos;re looking at the ad.</p>
                      )}
                    </div>
                  </form>
                ) : (
                  <form onSubmit={submitManual} noValidate className="stack">
                    <div className="field">
                      <label className="label" htmlFor="t">Ad title</label>
                      <input id="t" className="input" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="d">Full description</label>
                      <textarea
                        id="d" className="textarea" value={manual.description}
                        onChange={(e) => setManual({ ...manual, description: e.target.value })}
                        aria-invalid={!!descError} aria-describedby={descError ? "d-err" : "d-help"}
                      />
                      {descError ? (
                        <p className="field-err" id="d-err" role="alert">{descError}</p>
                      ) : (
                        <p className="help" id="d-help">Copy everything the seller wrote, including phone numbers.</p>
                      )}
                    </div>
                    <div className="two">
                      <div className="field">
                        <label className="label" htmlFor="p">Price</label>
                        <input id="p" className="input" inputMode="decimal" value={manual.price} onChange={(e) => setManual({ ...manual, price: e.target.value })} />
                      </div>
                      <div className="field">
                        <label className="label" htmlFor="l">Suburb and state</label>
                        <input id="l" className="input" value={manual.location} onChange={(e) => setManual({ ...manual, location: e.target.value })} />
                      </div>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="s">Seller or business name</label>
                      <input id="s" className="input" value={manual.sellerName} onChange={(e) => setManual({ ...manual, sellerName: e.target.value })} />
                    </div>
                    <div className="field">
                      <span className="label" id="photos-label">Photos from the ad</span>
                      <label className="dropzone" htmlFor="f">
                        <UploadSimple size={24} aria-hidden="true" />
                        <span>Add up to 6 photos</span>
                        <span className="help">Save them from the ad first. We check if they&apos;ve been stolen from elsewhere.</span>
                        <input id="f" type="file" accept="image/*" multiple aria-labelledby="photos-label" onChange={(e) => onFiles(e.target.files)} />
                      </label>
                      {images.length > 0 && (
                        <div className="thumbs">
                          {images.map((s, i) => (
                            <div className="thumb" key={i}>
                              <img src={s} alt={`Ad photo ${i + 1}`} />
                              <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setImages(images.filter((_, j) => j !== i))}>
                                <X size={14} weight="bold" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <button className="btn btn-primary" disabled={loading}>
                        {loading ? <CircleNotch className="spin" size={20} aria-hidden="true" /> : <ArrowRight size={20} weight="bold" aria-hidden="true" />}
                        {loading ? "Checking" : "Check listing"}
                      </button>
                    </div>
                  </form>
                )}

                <div className="switch-row">
                  <button type="button" className="linkbtn" onClick={() => { setMode(mode === "url" ? "manual" : "url"); setBlocked(false); }}>
                    {mode === "url" ? <><ClipboardText size={18} aria-hidden="true" /> No link? Paste the ad text instead</> : <><LinkSimple size={18} aria-hidden="true" /> Use a Gumtree link instead</>}
                  </button>
                  <span className="privacy"><LockSimple size={15} aria-hidden="true" /> Free. No sign-up.</span>
                </div>
              </div>
            </div>

            <div className="preview" aria-label="Example report">
              <div className="report">
                <div className="panel">
                  <ScoreHeader r={EXAMPLE} compact />
                </div>
                <div className="panel">
                  <h3>Warning signs</h3>
                  <div className="scan-bar" aria-hidden="true" />
                  {EXAMPLE_SIGNALS.map((s, i) => (
                    <div key={i} className="scan-row" style={{ "--i": i } as React.CSSProperties}>
                      <SignalRow s={s} />
                    </div>
                  ))}
                </div>
              </div>
              <p className="preview-cap">Example report for a typical scam ad.</p>
            </div>
          </div>
        </section>

        {showResults && (
          <section id="results" className="section" style={{ paddingTop: 24, scrollMarginTop: 80 }}>
            <div className="wrap" style={{ maxWidth: 880 }}>
              {loading && <ReportSkeleton />}

              {blocked && (
                <div className="notice" role="status">
                  <h3><WarningCircle size={20} weight="fill" aria-hidden="true" /> Gumtree didn&apos;t let us read that page</h3>
                  <ol>
                    <li>
                      Drag this button to your bookmarks bar:
                      <a className="bm" href={bm} onClick={(e) => e.preventDefault()}>
                        <BookmarkSimple size={16} weight="fill" aria-hidden="true" /> PetSales Check
                      </a>
                      Then open the Gumtree ad and click the bookmark. It reads the ad you&apos;re already looking at.
                    </li>
                    <li>
                      Or{" "}
                      <button type="button" className="linkbtn" onClick={() => { setMode("manual"); setBlocked(false); document.getElementById("main")?.scrollIntoView({ behavior: "smooth" }); }}>
                        paste the ad text and photos
                      </button>{" "}
                      instead.
                    </li>
                  </ol>
                </div>
              )}

              {error && !loading && (
                <div className="alert" role="alert">
                  <WarningCircle size={20} weight="fill" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {report && !loading && <ReportView r={report} />}
            </div>
          </section>
        )}

        <section id="how" className="section">
          <div className="wrap checks-grid">
            <div className="checks-intro">
              <h2 className="title">
                <span className="hl">{CHECK_COUNT} checks</span> on every ad.
              </h2>
              <p className="section-lede">
                Each one looks for a pattern that turns up again and again in Australian pet scams. Every warning in your report links to its source, so you can judge it yourself.
              </p>
              <div className="photo">
                <img src="/dog.jpg" alt="A black dog licking its nose" loading="lazy" width={606} height={468} />
              </div>
            </div>
            <ul className="areas">
              {AREAS.map((a) => (
                <li key={a.title} className="area">
                  <div className="area-ico"><a.icon size={22} aria-hidden="true" /></div>
                  <div>
                    <h3>
                      {a.title} <span className="count">{a.items.length}</span>
                    </h3>
                    <p>{a.body}</p>
                    <ul aria-label={`${a.title} checks`}>
                      {a.items.map((it) => <li key={it}>{it}</li>)}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="registers" aria-labelledby="reg-title">
          <div className="wrap" style={{ paddingTop: 72, paddingBottom: 56 }}>
            <h2 className="title" id="reg-title">We look up the breeder number for you.</h2>
            <p className="section-lede">Breeder numbers are required by law in four states. Where a state lets us, we search its register and put the answer in your report.</p>
            <div className="reg-grid">
              {REGISTERS.map((r) => (
                <div key={r.state} className="reg">
                  <div className="reg-state">{r.state}</div>
                  <div className="reg-name">{r.name}</div>
                  <span className={`reg-status${r.live ? " live" : ""}`}>
                    {r.live ? <CheckCircle size={14} weight="fill" aria-hidden="true" /> : null}
                    {r.status}
                  </span>
                  <p className="reg-note">{r.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap rules">
            <div>
              <h2 className="title">Five rules before you pay anyone.</h2>
              <p className="section-lede">A good score is never a reason to skip these. Scammers can write a clean-looking ad.</p>
              <div className="report-cta">
                <a className="btn btn-primary" href="#main">
                  <LinkSimple size={20} weight="bold" aria-hidden="true" /> Check listing
                </a>
                <a className="btn btn-ghost" href="https://www.scamwatch.gov.au/report-a-scam" target="_blank" rel="noreferrer">
                  Report a scam
                </a>
              </div>
            </div>
            <ol className="rule-list">
              {RULES.map((r) => (
                <li key={r.title} className="rule">
                  <div className="rule-ico"><r.icon size={40} weight="duotone" aria-hidden="true" /></div>
                  <div>
                    <strong>{r.title}</strong>
                    <span>{r.body}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-band" aria-hidden="true">
          <img className="sticker" src="/stickers/animals.png" alt="" width={880} height={276} loading="lazy" />
        </div>
        <div className="wrap footer-in">
          <img src="/logo@720.png" alt="PetSales.com.au" width={120} height={52} style={{ width: 120, height: "auto" }} loading="lazy" />
          <p>
            PetSales Scam Checker looks for warning signs. It can&apos;t prove a seller is honest or that they&apos;re a scammer. A high score isn&apos;t a guarantee, and a low score isn&apos;t an accusation.
          </p>
        </div>
      </footer>
    </>
  );
}
