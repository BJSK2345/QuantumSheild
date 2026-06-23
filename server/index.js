// ---------------------------------------------------------------------------
// index.js — QuantumShield API server (Express).
// Routes: /api/health, /api/scan, /api/protect, /api/unprotect,
//         /api/keys, /api/algorithms
// ---------------------------------------------------------------------------
import express from 'express';
import cors from 'cors';

import { scanFiles, RULES } from './lib/scanner.js';
import { computeScore } from './lib/scoring.js';
import { generateRoadmap } from './lib/roadmap.js';
import { protectFile, unprotectFile } from './lib/cryptoFile.js';
import { kem, dsa, slh, ALG_INFO } from './lib/pqc.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const b64 = (buf) => Buffer.from(buf).toString('base64');
const ok = (res, data) => res.json({ ok: true, ...data });
const fail = (res, code, message) => res.status(code).json({ ok: false, error: message });

// Detect post-quantum / crypto-agile signals to reward good design in scoring.
function detectPqcReady(text = '') {
  return /\b(ML-KEM|ML-DSA|SLH-DSA|Kyber|Dilithium|SPHINCS|post[- ]?quantum|crypto[- ]?agil)/i.test(text);
}

// --- Health ----------------------------------------------------------------
app.get('/api/health', (_req, res) =>
  ok(res, { service: 'quantumshield', rules: RULES.length, time: new Date().toISOString() })
);

// --- Algorithms (for the Key Upgrade UI copy) ------------------------------
app.get('/api/algorithms', (_req, res) => ok(res, { algorithms: ALG_INFO }));

// --- Scan ------------------------------------------------------------------
// body: { content?: string, filename?: string, files?: [{filename, content}] }
app.post('/api/scan', (req, res) => {
  try {
    const { content, filename, files } = req.body || {};
    let units = [];
    if (Array.isArray(files) && files.length) {
      units = files
        .filter((f) => typeof f?.content === 'string')
        .map((f) => ({ filename: f.filename || 'file', content: f.content }));
    } else if (typeof content === 'string') {
      units = [{ filename: filename || 'pasted-input', content }];
    }
    if (!units.length) return fail(res, 400, 'Provide `content` or a non-empty `files` array.');

    const { files: perFile, findings } = scanFiles(units);
    const pqcReady = units.some((u) => detectPqcReady(u.content));
    const score = computeScore(findings, { pqcReady });
    const roadmap = generateRoadmap(findings);

    return ok(res, { score, roadmap, findings, files: perFile, scannedAt: new Date().toISOString() });
  } catch (e) {
    return fail(res, 500, `Scan failed: ${e.message}`);
  }
});

// --- Protect (encrypt into a quantum-resistant package) --------------------
// body: { filename, dataBase64, recipientPublicKey? }
app.post('/api/protect', (req, res) => {
  try {
    const { filename, dataBase64, recipientPublicKey } = req.body || {};
    if (typeof dataBase64 !== 'string' || !dataBase64.length) {
      return fail(res, 400, 'Provide file bytes as `dataBase64`.');
    }
    const plaintext = Buffer.from(dataBase64, 'base64');
    const result = protectFile(plaintext, { filename, recipientPublicKey });

    const report = {
      status: 'protected',
      scheme: 'Hybrid KEM-DEM: ML-KEM-768 → HKDF-SHA256 → AES-256-GCM',
      file: result.package.file,
      keyOwnership: result.secretKey
        ? 'A new ML-KEM-768 key pair was generated. The SECRET KEY below is required to decrypt — store it safely; it is not recoverable.'
        : 'Encrypted to the supplied recipient public key; the recipient holds the matching secret key.',
      warnings: [
        'Quantum-resistant, not "quantum-proof". Security depends on safe key storage and implementation.',
        'This is a hackathon MVP; have the design and key management reviewed before production use.',
        'If you lose the secret key, the data cannot be recovered.',
      ],
    };

    return ok(res, {
      package: result.package,
      secretKey: result.secretKey, // base64 or null
      publicKey: result.publicKey,
      report,
    });
  } catch (e) {
    return fail(res, 500, `Protect failed: ${e.message}`);
  }
});

// --- Unprotect (decrypt the package) ---------------------------------------
// body: { package, secretKey }
app.post('/api/unprotect', (req, res) => {
  try {
    const { package: pkg, secretKey } = req.body || {};
    if (!pkg || typeof secretKey !== 'string') {
      return fail(res, 400, 'Provide the `package` object and base64 `secretKey`.');
    }
    const { plaintext, filename, integrityOk } = unprotectFile(pkg, secretKey);
    return ok(res, { filename, integrityOk, dataBase64: b64(plaintext), bytes: plaintext.length });
  } catch (e) {
    return fail(res, 400, e.message);
  }
});

// --- Key Upgrade (generate post-quantum-ready key material) ----------------
// body: { types?: ['kem','dsa','slh'] }  (defaults to all)
app.post('/api/keys', (req, res) => {
  try {
    const types = Array.isArray(req.body?.types) && req.body.types.length
      ? req.body.types
      : ['kem', 'dsa', 'slh'];
    const generators = { kem, dsa, slh };
    const guidance = {
      kem: 'ML-KEM protects/encapsulates a shared symmetric key. Use it for encryption key exchange — not for signing.',
      dsa: 'ML-DSA produces digital signatures to prove authenticity/integrity. Use it for signing, not encryption.',
      slh: 'SLH-DSA is a conservative hash-based signature scheme: larger/slower, but relies only on hash security.',
    };

    const out = {};
    for (const t of types) {
      const g = generators[t];
      if (!g) continue;
      const kp = g.keygen();
      out[t] = {
        algorithm: g.name,
        standard: g.standard,
        purpose: g.purpose,
        guidance: guidance[t],
        publicKey: b64(kp.publicKey),
        secretKey: b64(kp.secretKey),
        sizes: { publicKey: kp.publicKey.length, secretKey: kp.secretKey.length },
      };
    }

    return ok(res, {
      keys: out,
      disclaimer:
        'These are post-quantum-ready keys. They do not automatically replace existing keys in your system — ' +
        'integrate them deliberately, keep secret keys offline/encrypted, and have the rollout reviewed.',
    });
  } catch (e) {
    return fail(res, 500, `Key generation failed: ${e.message}`);
  }
});

app.use((err, _req, res, _next) => fail(res, 500, err.message || 'Unexpected error'));

app.listen(PORT, () => {
  console.log(`\n  QuantumShield API  ->  http://localhost:${PORT}`);
  console.log(`  Loaded ${RULES.length} scanner rules. PQC: ML-KEM-768 / ML-DSA-65 / SLH-DSA.\n`);
});
