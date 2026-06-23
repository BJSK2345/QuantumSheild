import { Panel, EmptyState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { downloadJSON } from '../api.js';

export function RoadmapPage({ result, goTo }) {
  if (!result) {
    return (
      <Panel>
        <EmptyState icon="route" title="No roadmap yet">
          Run a scan first — QuantumShield turns the findings into a phased, practical migration plan.
        </EmptyState>
        <div className="center"><button className="btn btn-primary" onClick={() => goTo('scan')}><Icon name="scan" size={16} /> Go to Scan</button></div>
      </Panel>
    );
  }

  const { roadmap, score } = result;
  const s = roadmap.summary;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <Panel title="Migration Roadmap" lead="A phased plan generated from your scan. Highlighted steps have evidence in your code; the rest are recommended regardless. This is guidance — require a developer/security review before production changes.">
        <div className="row wrap" style={{ gap: 22, marginTop: 6 }}>
          <Stat label="Risk score" value={`${score.riskScore} (${score.grade})`} />
          <Stat label="Steps triggered" value={`${s.triggeredSteps} / ${s.totalSteps}`} />
          <Stat label="Immediate action" value={s.immediateActionRequired ? 'Required' : 'No'} danger={s.immediateActionRequired} />
          <Stat label="PQ migration" value={s.quantumMigrationNeeded ? 'Needed' : 'Not flagged'} />
        </div>
        <div className="row mt"><button className="btn btn-sm btn-ghost" onClick={() => downloadJSON('quantumshield-roadmap.json', roadmap)}><Icon name="download" size={14} /> Export roadmap (JSON)</button></div>
      </Panel>

      <div className="grid" style={{ gap: 14 }}>
        {roadmap.steps.map((step, i) => (
          <div key={i} className={`step ${step.triggered ? 'triggered' : ''}`}>
            <div className="row between wrap" style={{ gap: 10 }}>
              <div>
                <div className="phase">{step.phase}</div>
                <h4>{step.title}</h4>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {step.triggered && step.relatedFindings > 0 && <span className="badge dim cat">{step.relatedFindings} finding{step.relatedFindings > 1 ? 's' : ''}</span>}
                <span className={`prio ${step.priority}`}>{step.priority}</span>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 13.5, margin: '10px 0 0', lineHeight: 1.6 }}>{step.why}</p>
            <ul>{step.actions.map((a, j) => <li key={j}>{a}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, danger }) {
  return (
    <div>
      <div className="faint" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: danger ? 'var(--critical)' : 'var(--text)' }}>{value}</div>
    </div>
  );
}
