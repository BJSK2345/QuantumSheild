import { Icon } from './icons.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'scan', label: 'Scan', icon: 'scan' },
  { id: 'protect', label: 'Protect', icon: 'lock' },
  { id: 'keys', label: 'Key Upgrade', icon: 'key' },
  { id: 'roadmap', label: 'Migration Roadmap', icon: 'route' },
];

export function Sidebar({ route, setRoute, online, collapsed, onToggleCollapse }) {
  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-mark">
          <Icon name="shield" size={22} strokeWidth={2} />
        </div>
        <div className="brand-text">
          <div className="brand-name">QuantumShield</div>
          <div className="brand-sub">PQ Readiness</div>
        </div>
      </div>

      <button className="collapse-btn" onClick={onToggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <Icon name="chevronLeft" className="ico" />
        <span className="nav-label">Collapse</span>
      </button>

      {NAV.map((n) => (
        <div
          key={n.id}
          className={`nav-item ${route === n.id ? 'active' : ''}`}
          onClick={() => setRoute(n.id)}
          title={collapsed ? n.label : undefined}
        >
          <Icon name={n.icon} className="ico" />
          <span className="nav-label">{n.label}</span>
        </div>
      ))}

      <div className="nav-spacer" />
      <div className="nav-foot" title={collapsed ? 'Runs in your browser' : undefined}>
        <div className="row" style={{ gap: 7 }}>
          <span className="dot" style={{ color: 'var(--low)' }}>●</span>
          <span className="nav-label">In-browser engine</span>
        </div>
        <div className="nav-foot-desc">
          Real ML-KEM-768 · ML-DSA-65 · SLH-DSA.<br />
          Quantum-resistant, not “quantum-proof”.
        </div>
      </div>
    </aside>
  );
}
