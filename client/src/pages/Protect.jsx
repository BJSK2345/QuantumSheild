import { useState } from 'react';
import { api, readAsBase64, readAsText, downloadJSON, downloadText, downloadBase64 } from '../api.js';
import { Panel, CopyField, Spinner } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

function FilePick({ onPick, label, hint, fileName }) {
  return (
    <label className="dropzone" style={{ display: 'block' }}>
      <Icon name="upload" size={26} />
      <div style={{ marginTop: 8, fontWeight: 600 }}>{fileName || label}</div>
      <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>{hint}</div>
      <input type="file" hidden onChange={(e) => e.target.files[0] && onPick(e.target.files[0])} />
    </label>
  );
}

export function ProtectPage() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const [error, setError] = useState(null);

  // Decryptor state
  const [pkgText, setPkgText] = useState('');
  const [skText, setSkText] = useState('');
  const [dec, setDec] = useState(null);
  const [decBusy, setDecBusy] = useState(false);
  const [decErr, setDecErr] = useState(null);

  async function protect() {
    if (!file) return;
    setBusy(true); setError(null); setOut(null);
    try {
      const dataBase64 = await readAsBase64(file);
      const res = await api.protect({ filename: file.name, dataBase64 });
      setOut(res);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  function loadIntoDecryptor() {
    if (!out) return;
    setPkgText(JSON.stringify(out.package, null, 2));
    setSkText(out.secretKey || '');
    setDec(null); setDecErr(null);
  }

  async function decrypt() {
    setDecBusy(true); setDecErr(null); setDec(null);
    try {
      const pkg = JSON.parse(pkgText);
      const res = await api.unprotect({ package: pkg, secretKey: skText.trim() });
      setDec(res);
    } catch (e) { setDecErr(e.message.includes('JSON') ? 'Package is not valid JSON.' : e.message); }
    finally { setDecBusy(false); }
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <Panel title="Protect Mode" lead="Encrypt a file into a quantum-resistant package using a hybrid KEM-DEM scheme: ML-KEM-768 encapsulates a key, HKDF-SHA256 derives it, and AES-256-GCM encrypts the data.">
        <FilePick onPick={(f) => { setFile(f); setOut(null); }} label="Choose a file to protect" hint="Any file type · stays on your machine until you click Protect" fileName={file && `${file.name} · ${(file.size / 1024).toFixed(1)} KB`} />
        <div className="row between mt">
          <span className="faint" style={{ fontSize: 12.5 }}>A fresh ML-KEM-768 key pair is generated; you must store the secret key to decrypt later.</span>
          <button className="btn btn-primary" onClick={protect} disabled={!file || busy}>
            {busy ? <><Spinner /> Protecting…</> : <><Icon name="lock" size={16} /> Protect file</>}
          </button>
        </div>
        {error && <div className="warn-box mt-sm">{error}</div>}
      </Panel>

      {out && (
        <>
          <div className="grid grid-2">
            <Panel title="Security report">
              <div className="ok-box" style={{ marginBottom: 14 }}>
                <b>✓ {out.report.status.toUpperCase()}</b> — {out.report.scheme}
              </div>
              <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.8 }}>
                <div><b>File:</b> {out.report.file.name} · {out.report.file.bytes} bytes</div>
                <div style={{ wordBreak: 'break-all' }}><b>SHA-256:</b> <span className="loc">{out.report.file.sha256}</span></div>
              </div>
              <div className="warn-box mt">
                <b>Important —</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {out.report.warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
                </ul>
              </div>
            </Panel>

            <Panel title="Package & keys">
              <div className="row wrap" style={{ gap: 10, marginBottom: 14 }}>
                <button className="btn btn-sm" onClick={() => downloadJSON(`${out.package.file.name}.qspkg.json`, out.package)}><Icon name="download" size={14} /> Encrypted package</button>
                {out.secretKey && <button className="btn btn-sm" onClick={() => downloadText(`${out.package.file.name}.mlkem-secret.key`, out.secretKey)}><Icon name="key" size={14} /> Secret key</button>}
                <button className="btn btn-sm btn-ghost" onClick={loadIntoDecryptor}><Icon name="arrow" size={14} /> Send to decryptor</button>
              </div>
              {out.secretKey && <CopyField label="ML-KEM-768 secret key" value={out.secretKey} danger onDownload={() => downloadText(`${out.package.file.name}.mlkem-secret.key`, out.secretKey)} />}
              <CopyField label="ML-KEM-768 public key" value={out.publicKey} />
              <details>
                <summary className="muted" style={{ cursor: 'pointer', fontSize: 13 }}>View package metadata (JSON)</summary>
                <pre className="code mt-sm" style={{ maxHeight: 220 }}>{JSON.stringify({ ...out.package, ciphertext: out.package.ciphertext.slice(0, 44) + '… (truncated)' }, null, 2)}</pre>
              </details>
            </Panel>
          </div>
        </>
      )}

      <Panel title="Decrypt / verify" lead="Recover a protected file with its ML-KEM-768 secret key. AES-GCM authentication means a wrong key or any tampering fails loudly.">
        <div className="grid grid-2">
          <div>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="faint" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Package JSON</span>
              <label className="btn btn-sm btn-ghost" style={{ padding: '3px 9px' }}>Load .json
                <input type="file" hidden accept=".json,application/json" onChange={async (e) => e.target.files[0] && setPkgText(await readAsText(e.target.files[0]))} />
              </label>
            </div>
            <textarea style={{ minHeight: 150 }} value={pkgText} onChange={(e) => setPkgText(e.target.value)} placeholder="Paste the .qspkg.json contents…" />
          </div>
          <div>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="faint" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Secret key (base64)</span>
              <label className="btn btn-sm btn-ghost" style={{ padding: '3px 9px' }}>Load .key
                <input type="file" hidden onChange={async (e) => e.target.files[0] && setSkText((await readAsText(e.target.files[0])).trim())} />
              </label>
            </div>
            <textarea style={{ minHeight: 150 }} value={skText} onChange={(e) => setSkText(e.target.value)} placeholder="Paste the ML-KEM secret key…" />
          </div>
        </div>
        <div className="row between mt">
          <span className="faint" style={{ fontSize: 12.5 }}>Decryption runs server-side via the same PQC layer.</span>
          <button className="btn btn-primary" onClick={decrypt} disabled={!pkgText || !skText || decBusy}>
            {decBusy ? <><Spinner /> Decrypting…</> : <><Icon name="check" size={16} /> Decrypt & verify</>}
          </button>
        </div>
        {decErr && <div className="warn-box mt-sm">{decErr}</div>}
        {dec && (
          <div className="ok-box mt-sm">
            <b>✓ Recovered “{dec.filename}”</b> ({dec.bytes} bytes) · integrity {dec.integrityOk ? 'verified (SHA-256 match)' : 'MISMATCH'}.
            <div className="mt-sm"><button className="btn btn-sm" onClick={() => downloadBase64(dec.filename, dec.dataBase64)}><Icon name="download" size={14} /> Download recovered file</button></div>
          </div>
        )}
      </Panel>
    </div>
  );
}
