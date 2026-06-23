import { useState } from 'react';
import { api, readAsText, downloadJSON } from '../api.js';
import { Panel, ExposureBar, RiskBadge, Spinner, EmptyState } from '../components/ui.jsx';
import { RiskGauge } from '../components/RiskGauge.jsx';
import { FindingCard } from '../components/FindingCard.jsx';
import { Icon } from '../components/icons.jsx';

const SAMPLE = `// payments.js — legacy service (example)
const crypto = require('crypto');

// RSA key exchange + ECDSA signing
const { publicKey, privateKey } = crypto.generateKeyPair('rsa', { modulusLength: 2048 });
const signer = crypto.createSign('SHA256');
const curve = 'secp256r1'; // prime256v1

// Weak hashing
const fingerprint = crypto.createHash('md5').update(token).digest('hex');
const legacy = crypto.createHash('sha1').update(blob).digest('hex');

// Outdated transport + cipher
const tls = { minVersion: 'TLSv1.0' };
const cipher = crypto.createCipheriv('aes-256-ecb', key, null);

// Hardcoded secrets (do not do this)
const API_KEY = "demo_secret_key_REPLACE_ME_0000";
const session = Math.random().toString(36);

-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAx4f...EXAMPLE...DO-NOT-USE...
-----END RSA PRIVATE KEY-----
`;

const RISK_ORDER = ['Critical', 'High', 'Medium', 'Low'];

export function ScanPage({ result, onResult, goTo }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]); // {name, content}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');

  async function addFiles(fileList) {
    const items = [];
    for (const file of Array.from(fileList)) {
      try { items.push({ name: file.name, content: await readAsText(file) }); } catch { /* skip */ }
    }
    setFiles((prev) => [...prev, ...items]);
  }

  async function runScan() {
    setError(null);
    const units = [...files.map((f) => ({ filename: f.name, content: f.content }))];
    if (text.trim()) units.unshift({ filename: 'pasted-input', content: text });
    if (!units.length) { setError('Paste some code or add a file first.'); return; }
    setLoading(true);
    try {
      const res = await api.scan({ files: units });
      onResult(res);
      setFilter('All');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const findings = result?.findings || [];
  const shown = filter === 'All' ? findings : findings.filter((f) => f.risk === filter);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <Panel title="Scan Mode" lead="Paste source/config or upload files. QuantumShield flags quantum-vulnerable, classically weak, and bad-practice cryptography — with a migration step for each finding.">
        <textarea className="codearea" placeholder="Paste code, configuration, or certificates here…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row wrap between mt">
          <div className="row wrap" style={{ gap: 10 }}>
            <label className="btn btn-sm">
              <Icon name="upload" size={15} /> Add files
              <input type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            </label>
            <button className="btn btn-sm btn-ghost" onClick={() => setText(SAMPLE)}>Load sample</button>
            {(text || files.length > 0) && (
              <button className="btn btn-sm btn-ghost" onClick={() => { setText(''); setFiles([]); }}>Clear</button>
            )}
          </div>
          <button className="btn btn-primary" onClick={runScan} disabled={loading}>
            {loading ? <><Spinner /> Scanning…</> : <><Icon name="scan" size={16} /> Run scan</>}
          </button>
        </div>
        {files.length > 0 && (
          <div className="tag-list mt-sm">
            {files.map((f, i) => (
              <span key={i} className="badge dim cat">{f.name}
                <span style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</span>
              </span>
            ))}
          </div>
        )}
        {error && <div className="warn-box mt-sm">{error}</div>}
      </Panel>

      {!result && (
        <Panel><EmptyState icon="scan" title="No scan yet">Run a scan to generate a quantum risk score, a categorized findings list, and a migration roadmap.</EmptyState></Panel>
      )}

      {result && (
        <>
          <div className="grid grid-2" style={{ gridTemplateColumns: '300px 1fr' }}>
            <Panel className="center">
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <RiskGauge score={result.score.riskScore} grade={result.score.grade} />
              </div>
              <div style={{ marginTop: 10, fontWeight: 600 }}>{result.score.label}</div>
              <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{result.score.totals.findings} findings</div>
            </Panel>

            <Panel title="Exposure breakdown">
              <ExposureBar label="Quantum-vulnerable" value={result.score.exposure.quantum} kind="q" />
              <ExposureBar label="Classically weak" value={result.score.exposure.classical} kind="c" />
              <ExposureBar label="Bad practice" value={result.score.exposure.practice} kind="p" />
              <div className="row wrap" style={{ gap: 18, marginTop: 16 }}>
                {RISK_ORDER.map((r) => (
                  <div key={r} className="row" style={{ gap: 8 }}>
                    <RiskBadge risk={r} />
                    <b>{result.score.totals.byRisk[r] || 0}</b>
                  </div>
                ))}
              </div>
              {result.score.mitigationApplied && <div className="ok-box mt">Crypto-agile / post-quantum signals detected — a mitigation discount was applied to the score.</div>}
              <div className="row wrap mt" style={{ gap: 10 }}>
                <button className="btn btn-sm" onClick={() => goTo('roadmap')}><Icon name="route" size={15} /> View migration roadmap</button>
                <button className="btn btn-sm btn-ghost" onClick={() => downloadJSON('quantumshield-report.json', result)}><Icon name="download" size={15} /> Export report (JSON)</button>
              </div>
              <p className="faint" style={{ fontSize: 11.5, marginTop: 14, lineHeight: 1.6 }}>{result.score.method}</p>
            </Panel>
          </div>

          <Panel title={`Findings (${findings.length})`}>
            <div className="row wrap" style={{ gap: 8, marginBottom: 16 }}>
              {['All', ...RISK_ORDER].map((r) => (
                <button key={r} className={`btn btn-sm ${filter === r ? '' : 'btn-ghost'}`} onClick={() => setFilter(r)}>
                  {r}{r !== 'All' && ` (${findings.filter((f) => f.risk === r).length})`}
                </button>
              ))}
            </div>
            <div className="grid" style={{ gap: 12 }}>
              {shown.length ? shown.map((f, i) => <FindingCard key={i} f={f} />)
                : <div className="ok-box">No {filter !== 'All' ? filter.toLowerCase() + ' ' : ''}findings. {findings.length === 0 && 'This input looks clean against the current rule set — still have a human review it.'}</div>}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
