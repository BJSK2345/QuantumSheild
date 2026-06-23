import { Panel, StatCard } from '../components/ui.jsx';
import { RiskGauge } from '../components/RiskGauge.jsx';
import { Icon } from '../components/icons.jsx';

const FEATURES = [
  { id: 'scan', icon: 'scan', title: 'Scan', desc: 'Detect quantum-vulnerable, classically weak, and bad-practice crypto in code and config.' },
  { id: 'protect', icon: 'lock', title: 'Protect', desc: 'Encrypt files into hybrid ML-KEM-768 + AES-256-GCM packages.' },
  { id: 'keys', icon: 'key', title: 'Key Upgrade', desc: 'Generate ML-KEM, ML-DSA, and SLH-DSA post-quantum-ready keys.' },
  { id: 'roadmap', icon: 'route', title: 'Roadmap', desc: 'Turn findings into a phased, practical migration plan.' },
];

export function Dashboard({ result, goTo }) {
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="hero fade-in">
        <span className="badge dim cat" style={{ marginBottom: 14 }}><Icon name="cpu" size={13} /> Post-quantum readiness</span>
        <h2>Get ahead of <span className="grad">“harvest now, decrypt later.”</span></h2>
        <p className="panel-lead" style={{ maxWidth: 640 }}>
          QuantumShield finds risky cryptography, explains why it’s exposed, and helps you generate
          quantum-resistant keys and encrypted packages. It’s migration assistance and risk assessment —
          not a guarantee.
        </p>
        <div className="row wrap" style={{ gap: 12, marginTop: 22 }}>
          <button className="btn btn-primary" onClick={() => goTo('scan')}><Icon name="scan" size={16} /> Run a scan</button>
          <button className="btn" onClick={() => goTo('protect')}><Icon name="lock" size={16} /> Protect a file</button>
        </div>
      </div>

      {result && (
        <div className="grid grid-4" style={{ gridTemplateColumns: '260px 1fr 1fr 1fr' }}>
          <Panel className="center">
            <div style={{ display: 'grid', placeItems: 'center' }}><RiskGauge score={result.score.riskScore} grade={result.score.grade} size={150} /></div>
            <button className="btn btn-sm btn-ghost mt-sm" onClick={() => goTo('roadmap')}>View roadmap</button>
          </Panel>
          <StatCard label="Total findings" value={result.score.totals.findings} sub={result.score.label} />
          <StatCard label="Critical + High" value={(result.score.totals.byRisk.Critical || 0) + (result.score.totals.byRisk.High || 0)} sub="need attention first" color="var(--high)" />
          <StatCard label="Quantum exposure" value={`${result.score.exposure.quantum}/100`} sub="from RSA/ECC usage" color="var(--accent-2)" />
        </div>
      )}

      <div>
        <h3 className="panel-title" style={{ marginBottom: 14 }}>Modules</h3>
        <div className="grid grid-4">
          {FEATURES.map((f) => (
            <Panel key={f.id} className="feature" onClick={() => goTo(f.id)}>
              <div className="ico-wrap" style={{ color: 'var(--accent)' }}><Icon name={f.icon} size={20} /></div>
              <h4 style={{ margin: '0 0 6px', fontSize: 16 }}>{f.title}</h4>
              <p className="panel-lead" style={{ fontSize: 13.5 }}>{f.desc}</p>
            </Panel>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <Panel title="Why this matters">
          <p className="panel-lead">
            Large quantum computers running <b style={{ color: 'var(--text)' }}>Shor’s algorithm</b> would break RSA and
            elliptic-curve cryptography. Attackers don’t have to wait: under <b style={{ color: 'var(--text)' }}>“harvest now,
            decrypt later,”</b> they can capture encrypted traffic today and decrypt it once the hardware exists.
          </p>
          <p className="panel-lead mt-sm">
            Long-lived secrets — health, financial, and government data — are most at risk. Migrating early to
            standardized post-quantum algorithms (ML-KEM, ML-DSA, SLH-DSA) closes that window.
          </p>
        </Panel>
        <Panel title="What QuantumShield does — and doesn’t — claim">
          <div className="ok-box" style={{ marginBottom: 12 }}>
            <b>Does:</b> risk assessment, post-quantum-ready key generation, hybrid encryption, and migration guidance.
          </div>
          <div className="warn-box">
            <b>Doesn’t:</b> make anything “100% quantum-proof,” “impossible to decrypt,” or automatically fix your
            system. Security still depends on implementation, key storage, and a developer/security review.
          </div>
        </Panel>
      </div>
    </div>
  );
}
