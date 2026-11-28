"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookmarkSimple,
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

const CHECKS = [
  { icon: ChatCenteredText, title: "Scam wording", body: "Shipping offers, deposits before viewing, PayID-only, sob stories and surprise crate or insurance fees." },
  { icon: ClipboardText, title: "Copy-paste ads", body: "We search the web for the ad's wording. Scam templates get reused word for word." },
  { icon: Phone, title: "Phone, email and name", body: "Matched against scam reports and warnings published online." },
  { icon: InstagramLogo, title: "Facebook and Instagram", body: "Links to the seller's social pages, so you can check their history." },
  { icon: IdentificationCard, title: "Breeder ID", body: "VIC, NSW, QLD and SA ads must show one by law. We check it's there." },
  { icon: CurrencyDollar, title: "Price vs market", body: "Too cheap for the breed is the number one scam lure." },
  { icon: Buildings, title: "Website and ABN", body: "Brand-new websites and cancelled ABNs are flagged." },
];

const RULES = [
  { icon: Eye, title: "See the pet in person", body: "Or a live video call where the seller says your name and shows the pet with its mum." },
  { icon: HandCoins, title: "No deposits to strangers", body: "Never pay by bank transfer, PayID, gift card or crypto before you've met. Banks never charge you to receive a PayID payment." },
  { icon: Truck, title: "No shipping, no fees", body: "Pet transport, crate, insurance or quarantine fees are how the scam escalates." },
  { icon: IdentificationCard, title: "Verify the numbers", body: "Look up the breeder ID on your state register and check the microchip is in the seller's name." },
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

  useEffect(() => {
    setOrigin(window.location.origin);
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
                Check the pet ad <span className="hl">before you pay.</span>
              </h1>
              <p className="lede">
                Paste a Gumtree link. We check the photos, wording, price, seller and breeder ID, then score it out of 100.
              </p>

              <div className="checker">
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
                  {EXAMPLE_SIGNALS.map((s, i) => <SignalRow key={i} s={s} />)}
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

        <section id="how" className="section section-deep">
          <div className="wrap">
            <h2 className="title">Eight checks on every ad.</h2>
            <p className="section-lede">
              Each check looks for a pattern we see again and again in pet scams. Every warning links to its source so you can judge it yourself.
            </p>
            <div className="bento">
              <article className="cell cell-feature">
                <img src="/dog.jpg" alt="A black dog licking its nose against a navy background" loading="lazy" />
                <div className="cell-ico"><Images size={22} aria-hidden="true" /></div>
                <h3>Reverse image search</h3>
                <p>Most scam ads use photos stolen from real breeders. We look for the same photos anywhere else online.</p>
              </article>
              {CHECKS.map((c, i) => (
                <article key={c.title} className={`cell${i === 0 ? " cell-wide" : ""}`}>
                  <div className="cell-ico"><c.icon size={22} aria-hidden="true" /></div>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </article>
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
                  <div className="rule-ico"><r.icon size={22} aria-hidden="true" /></div>
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
