import type { IconKind } from "../../lib/weather/types";

/** White line icons, drawn on a 48×48 grid. */
export function WeatherIcon({ kind, size = 40 }: { kind: IconKind; size?: number }) {
  const cloud = <path d="M15 36h20a7 7 0 0 0 .8-13.95A10 10 0 0 0 16.6 20.6 7.7 7.7 0 0 0 15 36Z" />;
  const smallCloud = <path d="M17 38h17a6 6 0 0 0 .7-11.96 8.5 8.5 0 0 0-16.3-1.2A6.6 6.6 0 0 0 17 38Z" />;
  const sun = (cx: number, cy: number, r: number) => (
    <g>
      <circle cx={cx} cy={cy} r={r} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={cx + Math.cos(a) * (r + 3)} y1={cy + Math.sin(a) * (r + 3)} x2={cx + Math.cos(a) * (r + 6)} y2={cy + Math.sin(a) * (r + 6)} />;
      })}
    </g>
  );
  const moon = (cx: number, cy: number, r: number) => (
    <path d={`M${cx + r * 0.3} ${cy - r} A${r} ${r} 0 1 0 ${cx + r} ${cy + r * 0.3} A${r * 0.8} ${r * 0.8} 0 0 1 ${cx + r * 0.3} ${cy - r}Z`} />
  );
  const drops = (n: number) =>
    Array.from({ length: n }, (_, i) => <line key={i} x1={18 + i * 7} y1={41} x2={16 + i * 7} y2={46} />);

  const body = (() => {
    switch (kind) {
      case "sun": return sun(24, 24, 8);
      case "moon": return moon(22, 24, 11);
      case "partly-day": return <>{sun(31, 15, 6)}{smallCloud}</>;
      case "partly-night": return <>{moon(30, 14, 7)}{smallCloud}</>;
      case "cloud": return cloud;
      case "fog": return <>{cloud}<line x1="10" y1="41" x2="38" y2="41" /><line x1="14" y1="46" x2="34" y2="46" /></>;
      case "showers": return <>{sun(33, 13, 5)}{smallCloud}{drops(2)}</>;
      case "rain": return <>{cloud}{drops(3)}</>;
      case "storm": return <>{cloud}<path d="M25 36l-4 6h5l-3 6" /></>;
      case "snow": return <>{cloud}<text x="17" y="47" fontSize="9" stroke="none" fill="currentColor">* * *</text></>;
    }
  })();

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {body}
    </svg>
  );
}
