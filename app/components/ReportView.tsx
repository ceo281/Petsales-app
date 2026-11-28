"use client";

import { useEffect, useState } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  MagnifyingGlass,
  MinusCircle,
  Question,
  SealCheck,
  WarningCircle,
  WarningOctagon,
} from "@phosphor-icons/react";
import type { Report, Signal } from "../../lib/types";

const BAND = {
  "high-risk": { label: "High risk", line: "Strong scam warning signs", color: "var(--danger)" },
  caution: { label: "Caution", line: "Some warning signs to check", color: "var(--warn)" },
  "lower-risk": { label: "Fewer warning signs", line: "Still meet the pet before you pay", color: "var(--accent)" },
} as const;

export function ScoreRing({ score, color, size = 132 }: { score: number; color: string; size?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  // Animate from empty on mount; reduced-motion users get the CSS transition disabled.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`Safety score ${score} out of 100`}>
      <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ring-track" cx="60" cy="60" r={r} fill="none" strokeWidth="9" />
        <circle
          className="ring-val"
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)}
        />
      </svg>
      <div className="ring-num" aria-hidden="true">
        <div>
          <strong>{score}</strong>
          <span>of 100</span>
        </div>
      </div>
    </div>
  );
}

function SignalRow({ s }: { s: Signal }) {
  const kind = s.points < 0 ? "neg" : s.points > 0 ? "pos" : "zero";
  const Icon = kind === "neg" ? WarningCircle : kind === "pos" ? CheckCircle : Question;
  return (
    <div className="sig">
      <Icon className={`sig-ico ${kind}`} size={22} weight="fill" aria-hidden="true" />
      <div>
        <div className="sig-label">{s.label}</div>
        {s.detail && <div className="sig-detail">{s.detail}</div>}
        {s.links && s.links.length > 0 && (
          <div className="sig-links">
            {s.links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer nofollow">
                <ArrowSquareOut size={15} aria-hidden="true" />
                {l.title}
              </a>
            ))}
          </div>
        )}
      </div>
      <span className="pts" aria-label={`${s.points} points`}>{s.points > 0 ? `+${s.points}` : s.points}</span>
    </div>
  );
}

export function ScoreHeader({ r, compact = false }: { r: Pick<Report, "score" | "band" | "confidence" | "listing">; compact?: boolean }) {
  const b = BAND[r.band];
  const pct = Math.round(r.confidence * 100);
  return (
    <div className="score-head">
      <ScoreRing score={r.score} color={b.color} size={compact ? 108 : 132} />
      <div>
        <p className={`band ${r.band}`}>{b.label}</p>
        <p className="meta">{b.line}</p>
        <p className="meta">
          {pct}% of checks completed{pct < 60 ? ". Limited evidence, so treat this score with caution." : "."}
        </p>
        {r.listing.title && (
          <p className="listing-title">
            {r.listing.title}
            {r.listing.priceText ? `, ${r.listing.priceText}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

export function ReportView({ r }: { r: Report }) {
  const all = r.checks.flatMap((c) => c.signals);
  const neg = all.filter((s) => s.points < 0).sort((a, b) => a.points - b.points);
  const pos = all.filter((s) => s.points > 0).sort((a, b) => b.points - a.points);
  const zero = all.filter((s) => s.points === 0);

  return (
    <section className="report fade-up" id="report" aria-live="polite" aria-label="Scam check report">
      <div className="panel">
        <ScoreHeader r={r} />
      </div>

      <div className="panel">
        {neg.length === 0 && pos.length === 0 && zero.length === 0 && (
          <p className="meta">We didn&apos;t find specific signals in this ad. That isn&apos;t proof it&apos;s safe. Use the links below to check it yourself.</p>
        )}
        {neg.length > 0 && (
          <div className="sig-group">
            <h3><WarningOctagon size={20} weight="fill" color="var(--danger)" aria-hidden="true" /> Warning signs ({neg.length})</h3>
            {neg.map((s, i) => <SignalRow key={i} s={s} />)}
          </div>
        )}
        {zero.length > 0 && (
          <div className="sig-group">
            <h3><Question size={20} weight="fill" color="var(--warn)" aria-hidden="true" /> Worth checking ({zero.length})</h3>
            {zero.map((s, i) => <SignalRow key={i} s={s} />)}
          </div>
        )}
        {pos.length > 0 && (
          <div className="sig-group">
            <h3><SealCheck size={20} weight="fill" color="var(--accent)" aria-hidden="true" /> Reassuring signs ({pos.length})</h3>
            {pos.map((s, i) => <SignalRow key={i} s={s} />)}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>What we checked</h3>
        <div className="chips">
          {r.checks.map((c) => (
            <span key={c.id} className={`chip ${c.status}`} title={c.note}>
              {c.status === "ran" ? <CheckCircle size={16} weight="fill" aria-hidden="true" /> : <MinusCircle size={16} aria-hidden="true" />}
              {c.name}
              <span className="sr-only">: {c.status === "ran" ? "done" : c.note || c.status}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Check it yourself</h3>
        <div className="manual">
          {r.manualLinks.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noreferrer nofollow">
              <MagnifyingGlass size={18} aria-hidden="true" />
              {l.title}
            </a>
          ))}
        </div>
      </div>

      <p className="disclaimer">
        This report shows warning signs, not proof. A low score isn&apos;t an accusation against the seller, and a high score isn&apos;t a guarantee. Always see the pet in person before paying.
      </p>
    </section>
  );
}

export function ReportSkeleton() {
  return (
    <div className="report" aria-busy="true" aria-label="Checking the listing">
      <div className="panel">
        <div className="score-head">
          <div className="sk sk-ring" />
          <div>
            <div className="sk sk-line" style={{ width: "40%", height: 22 }} />
            <div className="sk sk-line" style={{ width: "70%" }} />
            <div className="sk sk-line" style={{ width: "55%" }} />
          </div>
        </div>
      </div>
      <div className="panel">
        {[82, 64, 76, 58].map((w, i) => (
          <div key={i} className="sk sk-line" style={{ width: `${w}%`, margin: "18px 0" }} />
        ))}
      </div>
    </div>
  );
}
