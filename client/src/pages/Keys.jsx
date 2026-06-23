import { useState } from 'react';
import { api, downloadText } from '../api.js';
import { Panel, CopyField, Spinner } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

const META = {
  kem: { tag: 'Encryption / key exchange', accent: 'var(--accent)' },
  dsa: { tag: 'Digital signatures', accent: 'var(--accent-2)' },
  slh: { tag: 'High-security signatures', accent: 'var(--info)' },
};

export function KeysPage() {
  const [keys, setKeys] = useState(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [busy, setBusy] = useState(null); // 'all' | type
  const [error, setError] = useState(null);

  async function gen(types, tag) {
    setBusy(tag); setError(null);
    try {
      const res = await api.keys(types);
      setKeys((prev) => ({ ...(prev || {}), ...res.keys }));
      setDisclaimer(res.disclaimer);
    } catch (e) { setError(e.message); }
    finally { setBusy(null); }
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <Panel title="Key Upgrade Mode" lead="Generate post-quantum-ready key material. These algorithms address different jobs — they do not automatically replace every existing key in your system.">
        <div className="grid grid-3 mt-sm" style={{ gap: 14 }}>
          <div className="note"><b style={{ color: 'var(--accent)' }}>ML-KEM</b> protects/encapsulates a shared symmetric key. Use it for key exchange — not signing.</div>
          <div className="note"><b style={{ color: 'var(--accent-2)' }}>ML-DSA</b> creates digital signatures that prove authenticity and integrity. Use it for signing — not encryption.</div>
          <div className="note"><b style={{ color: 'var(--info)' }}>SLH-DSA</b> is a conservative hash-based signature option: larger and slower, but relies only on hash security.</div>
        </div>
        <div className="row between mt wrap" style={{ gap: 12 }}>
          <span className="faint" style={{ fontSize: 12.5 }}>Keys are generated on the server with real FIPS 203/204/205 implementations.</span>
          <button className="btn btn-primary" onClick={() => gen(['kem', 'dsa', 'slh'], 'all')} disabled={busy}>
            {busy === 'all' ? <><Spinner /> Generating…</> : <><Icon name="spark" size={16} /> Generate all three</>}
          </button>
        </div>
        {error && <div className="warn-box mt-sm">{error}</div>}
      </Panel>

      <div className="grid grid-3">
        {['kem', 'dsa', 'slh'].map((t) => {
          const k = keys?.[t];
          return (
            <Panel key={t} title={META[t].tag} style={{ borderColor: k ? 'var(--border-strong)' : undefined }}>
              <div className="row between">
                <h3 style={{ margin: 0, fontSize: 18, color: META[t].accent }}>{k?.algorithm || { kem: 'ML-KEM-768', dsa: 'ML-DSA-65', slh: 'SLH-DSA' }[t]}</h3>
                <span className="badge dim cat">{k?.standard || { kem: 'FIPS 203', dsa: 'FIPS 204', slh: 'FIPS 205' }[t]}</span>
              </div>
              <p className="panel-lead" style={{ marginTop: 10, minHeight: 60 }}>{k?.guidance || { kem: 'Wraps the symmetric key used to encrypt your data.', dsa: 'Signs data so recipients can verify it is authentic.', slh: 'Hash-based signatures for the most conservative threat models.' }[t]}</p>

              {!k ? (
                <button className="btn" style={{ width: '100%' }} onClick={() => gen([t], t)} disabled={busy}>
                  {busy === t ? <><Spinner /> Generating…</> : <><Icon name="key" size={15} /> Generate key pair</>}
                </button>
              ) : (
                <>
                  <div className="faint" style={{ fontSize: 12, marginBottom: 10 }}>public {k.sizes.publicKey} B · secret {k.sizes.secretKey} B</div>
                  <CopyField label="Public key" value={trunc(k.publicKey)} onDownload={() => downloadText(`${t}-public.key`, k.publicKey)} />
                  <CopyField label="Secret key" value={trunc(k.secretKey)} danger onDownload={() => downloadText(`${t}-secret.key`, k.secretKey)} />
                </>
              )}
            </Panel>
          );
        })}
      </div>

      {disclaimer && <div className="warn-box"><b>Heads up —</b> {disclaimer}</div>}
    </div>
  );
}

// Show a readable preview; full value is available via copy/download.
function trunc(b64) {
  return b64.length > 120 ? `${b64.slice(0, 88)}…  (${b64.length} chars — use copy/download for the full key)` : b64;
}
