import { useState, useCallback, createContext, useContext } from 'react';
import { Icon } from './icons.jsx';

export function Panel({ title, lead, children, className = '', style, onClick }) {
  return (
    <section className={`panel fade-in ${className}`} style={style} onClick={onClick}>
      {title && <h3 className="panel-title">{title}</h3>}
      {lead && <p className="panel-lead" style={{ marginBottom: 14 }}>{lead}</p>}
      {children}
    </section>
  );
}

export function StatCard({ label, value, sub, color }) {
  return (
    <Panel className="stat">
      <span className="label">{label}</span>
      <span className="value" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="sub">{sub}</span>}
    </Panel>
  );
}

export function RiskBadge({ risk }) {
  return (
    <span className={`badge risk-${risk}`}>
      <span className="d" />
      {risk}
    </span>
  );
}

export function CategoryBadge({ category }) {
  const label = { 'quantum-vulnerable': 'Quantum-vulnerable', 'classically-weak': 'Classically weak', 'bad-practice': 'Bad practice' }[category] || category;
  return <span className="badge dim cat">{label}</span>;
}

export function ExposureBar({ label, value, kind }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="muted" style={{ fontSize: 13 }}>{label}</span>
        <span style={{ fontSize: 13, fontFamily: 'var(--mono)' }}>{value}/100</span>
      </div>
      <div className={`bar bar-${kind}`}><span style={{ width: `${value}%` }} /></div>
    </div>
  );
}

// --- Toast (copy confirmation) ---------------------------------------------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const show = useCallback((m) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 1800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="copy-toast fade-in">{msg}</div>}
    </ToastCtx.Provider>
  );
}

// Read-only key/secret field with copy + optional download.
export function CopyField({ label, value, onDownload, danger }) {
  const toast = useToast();
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast('Copied to clipboard'); }
    catch { toast('Copy failed — select manually'); }
  };
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div className="row between" style={{ marginBottom: 6 }}>
          <span className="faint" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
          {danger && <span className="badge risk-Critical" style={{ fontSize: 10 }}>keep secret</span>}
        </div>
      )}
      <div className="keyfield">
        <div className="code">{value}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-sm" onClick={copy} title="Copy"><Icon name="copy" size={14} /></button>
          {onDownload && <button className="btn btn-sm" onClick={onDownload} title="Download"><Icon name="download" size={14} /></button>}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'scan', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={46} />
      <h3 style={{ margin: '0 0 6px', color: 'var(--text-dim)' }}>{title}</h3>
      <p style={{ margin: 0, maxWidth: 420, marginInline: 'auto', fontSize: 14, lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

export function Spinner() { return <span className="spinner" />; }
