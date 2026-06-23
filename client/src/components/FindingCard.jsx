import { RiskBadge, CategoryBadge } from './ui.jsx';

export function FindingCard({ f }) {
  return (
    <div className={`finding ${f.risk}`}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <h4>{f.title}</h4>
        <div className="row" style={{ gap: 8 }}>
          <RiskBadge risk={f.risk} />
          <CategoryBadge category={f.category} />
        </div>
      </div>
      <div className="row wrap mt-sm" style={{ gap: 10 }}>
        <span className="loc">{f.filename}:{f.line}:{f.column}</span>
        {f.match && <code className="loc" style={{ color: 'var(--text-dim)' }}>matched “{f.match}”</code>}
      </div>
      <p className="exp">{f.explanation}</p>
      <div className="mig"><b>Migration →</b> {f.migration}</div>
    </div>
  );
}
