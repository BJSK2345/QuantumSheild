// Circular SVG risk gauge with a glowing arc. score: 0–100 (higher = riskier).
export function RiskGauge({ score = 0, grade, label, size = 200 }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  // 270° sweep (gauge style), leaving a gap at the bottom.
  const sweep = 0.75;
  const dash = c * sweep;
  const offset = dash * (1 - pct / 100);

  const color = pct >= 80 ? 'var(--critical)' : pct >= 60 ? 'var(--high)' : pct >= 40 ? 'var(--medium)' : pct >= 20 ? 'var(--info)' : 'var(--low)';
  const center = size / 2;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(135deg)' }}>
        <circle cx={center} cy={center} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
        <circle cx={center} cy={center} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 10px ${color})` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: size * 0.3, fontWeight: 800, lineHeight: 1, color }}>{score}</div>
        <div className="faint" style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Risk score</div>
        {grade && (
          <div style={{ marginTop: 8 }}>
            <span className="badge" style={{ color, borderColor: color, background: 'transparent' }}>Grade {grade}</span>
          </div>
        )}
      </div>
    </div>
  );
}
