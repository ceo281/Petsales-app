"use client";

import { useEffect, useMemo, useState } from "react";
import type { Report } from "../lib/types";

type Mode = "url" | "manual";

/**
 * Runs on the Gumtree page in the user's own browser, captures what they can
 * already see, and opens the checker with it in the URL hash (never sent to
 * any server except ours, when they press Check).
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

export default function Home() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [manual, setManual] = useState({ title: "", description: "", price: "", location: "", sellerName: "" });
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
      check({ capture });
    } catch {
      setError("Couldn't read the captured listing. Try the bookmark again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check(body: object) {
    setLoading(true);
    setError("");
    setBlocked(false);
    setReport(null);
    try {
      const res = await fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.blocked) {
        setBlocked(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Check failed");
      setReport(data);
      setTimeout(() => document.getElementById("report")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const picked = [...files].filter((f) => f.type.startsWith("image/") && f.size < 4_000_000).slice(0, 6 - images.length);
    const urls = await Promise.all(picked.map(readFileAsDataUrl));
    setImages((prev) => [...prev, ...urls].slice(0, 6));
  }

  const bm = useMemo(() => (origin ? bookmarkletCode(origin) : "#"), [origin]);

  return (
    <main>
      <h1>🐾 PetSales Scam Checker</h1>
      <p className="sub">Looking at a puppy or kitten on Gumtree? Check the ad for scam warning signs before you pay a cent.</p>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className={mode === "url" ? "" : "secondary"} onClick={() => setMode("url")}>Paste a link</button>
          <button className={mode === "manual" ? "" : "secondary"} onClick={() => setMode("manual")}>Paste the ad text</button>
        </div>

        {mode === "url" ? (
          <form onSubmit={(e) => { e.preventDefault(); check({ url }); }}>
            <label htmlFor="url">Gumtree listing link</label>
            <div className="row">
              <input id="url" className="grow" type="url" required placeholder="https://www.gumtree.com.au/s-ad/..." value={url} onChange={(e) => setUrl(e.target.value)} />
              <button disabled={loading}>{loading ? "Checking…" : "Check it"}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); check({ url: url || undefined, manual: { ...manual, images } }); }}>
            <label htmlFor="t">Ad title</label>
            <input id="t" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} placeholder="Cavoodle puppies ready now" />
            <label htmlFor="d">Full description (copy everything from the ad)</label>
            <textarea id="d" required value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} />
            <div className="row">
              <div className="grow"><label htmlFor="p">Price</label><input id="p" value={manual.price} onChange={(e) => setManual({ ...manual, price: e.target.value })} placeholder="$1,200" /></div>
              <div className="grow"><label htmlFor="l">Location</label><input id="l" value={manual.location} onChange={(e) => setManual({ ...manual, location: e.target.value })} placeholder="Geelong VIC" /></div>
            </div>
            <label htmlFor="s">Seller or business name</label>
            <input id="s" value={manual.sellerName} onChange={(e) => setManual({ ...manual, sellerName: e.target.value })} />
            <label htmlFor="f">Photos from the ad (save them and add up to 6)</label>
            <input id="f" type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} />
            {images.length > 0 && (
              <div className="thumbs">{images.map((s, i) => <img key={i} src={s} alt={`Photo ${i + 1}`} onClick={() => setImages(images.filter((_, j) => j !== i))} title="Click to remove" />)}</div>
            )}
            <div style={{ marginTop: 16 }}><button disabled={loading}>{loading ? "Checking…" : "Check it"}</button></div>
          </form>
        )}

        {blocked && (
          <div className="notice">
            <strong>Gumtree didn&apos;t let our server read that page.</strong> Two easy options:
            <ol>
              <li>Drag this button to your bookmarks bar: <a className="bm" href={bm} onClick={(e) => e.preventDefault()}>🐾 Check this pet ad</a> — then open the Gumtree ad and click the bookmark. It reads the ad you&apos;re already looking at and sends it here.</li>
              <li>Or <a href="#" onClick={(e) => { e.preventDefault(); setMode("manual"); setBlocked(false); }}>paste the ad text and photos</a> instead.</li>
            </ol>
          </div>
        )}
        {error && <p className="err">{error}</p>}
      </div>

      {report && <ReportView r={report} />}

      <div className="card">
        <h2>Before you pay — every time</h2>
        <ol className="tips">
          <li><strong>See the pet in person</strong> (or a live video call where they say your name and show the pet with its mum). Never pay for an animal you haven&apos;t seen.</li>
          <li><strong>Never pay a deposit by bank transfer, PayID, gift card or crypto</strong> to someone you haven&apos;t met. Scammers love PayID &quot;upgrade&quot; emails — banks never ask you to pay to receive PayID money.</li>
          <li><strong>No shipping.</strong> &quot;Pet transport&quot;, crate, insurance or quarantine fees are the classic scam escalation.</li>
          <li><strong>Check the breeder/source number</strong> on your state register (VIC, NSW, QLD, SA require it in ads) and that the microchip is registered to the seller.</li>
          <li>Scammed or suspicious? Report it to <a href="https://www.scamwatch.gov.au/report-a-scam" target="_blank" rel="noreferrer">Scamwatch</a>, to Gumtree, and call your bank immediately.</li>
        </ol>
        <p className="muted">PetSales Scam Checker looks for warning signs. It can&apos;t prove a seller is honest or that they&apos;re a scammer — a high score is not a guarantee, and a low score is not an accusation.</p>
      </div>
    </main>
  );
}

function ReportView({ r }: { r: Report }) {
  const label = { "high-risk": "High risk — strong scam warning signs", caution: "Caution — some warning signs", "lower-risk": "Fewer warning signs found" }[r.band];
  const allSignals = r.checks.flatMap((c) => c.signals.map((s) => ({ ...s, check: c.name }))).sort((a, b) => a.points - b.points);
  return (
    <div id="report">
      <div className="card">
        <div className="score">
          <div className={`dial ${r.band}`}>{r.score}</div>
          <div>
            <div className="band">{label}</div>
            <div className="muted">Safety score out of 100 · higher is better</div>
            <div className="muted">Checks completed: {Math.round(r.confidence * 100)}%{r.confidence < 0.6 && " — limited evidence, treat this score with caution"}</div>
            {r.listing.title && <div style={{ marginTop: 6 }}><strong>{r.listing.title}</strong>{r.listing.priceText && ` · ${r.listing.priceText}`}</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>What we found</h2>
        {allSignals.length === 0 ? <p className="muted">No specific signals found.</p> : (
          <ul className="sig">
            {allSignals.map((s, i) => (
              <li key={i}>
                <span className={`pts ${s.points < 0 ? "neg" : s.points > 0 ? "pos" : "zero"}`}>{s.points > 0 ? `+${s.points}` : s.points}</span>
                <strong>{s.label}</strong> <span className="muted">· {s.check}</span>
                {s.detail && <div className="muted">{s.detail}</div>}
                {s.links && <div>{s.links.map((l, j) => <div key={j}>↳ <a href={l.url} target="_blank" rel="noreferrer nofollow">{l.title}</a></div>)}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Checks</h2>
        <div className="checks">
          {r.checks.map((c) => (
            <div className="chk" key={c.id}>
              {c.status === "ran" ? "✅" : c.status === "na" ? "➖" : c.status === "skipped" ? "⏭️" : "⚠️"} <strong>{c.name}</strong>
              {c.note && <div className="muted">{c.note}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Check it yourself</h2>
        {r.manualLinks.map((l, i) => <div key={i}>↳ <a href={l.url} target="_blank" rel="noreferrer nofollow">{l.title}</a></div>)}
      </div>
    </div>
  );
}
