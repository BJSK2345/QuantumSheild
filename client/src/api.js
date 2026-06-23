// ---------------------------------------------------------------------------
// api.js — In-browser engine. Same interface the pages already use, but every
// operation now runs client-side (no backend). The app is a static SPA.
// ---------------------------------------------------------------------------
import { scanFiles } from './engine/scanner.js';
import { computeScore } from './engine/scoring.js';
import { generateRoadmap } from './engine/roadmap.js';
import { protectFile, unprotectFile } from './engine/crypto.js';
import { kem, dsa, slh, getAlgInfo } from './engine/pqc.js';
import { bytesToB64, fromB64 } from './engine/bytes.js';

function detectPqcReady(text = '') {
  return /\b(ML-KEM|ML-DSA|SLH-DSA|Kyber|Dilithium|SPHINCS|post[- ]?quantum|crypto[- ]?agil)/i.test(text);
}

const KEY_GUIDANCE = {
  kem: 'ML-KEM protects/encapsulates a shared symmetric key. Use it for encryption key exchange — not for signing.',
  dsa: 'ML-DSA produces digital signatures to prove authenticity/integrity. Use it for signing, not encryption.',
  slh: 'SLH-DSA is a conservative hash-based signature scheme: larger/slower, but relies only on hash security.',
};

export const api = {
  async health() {
    return { ok: true, engine: 'in-browser', algorithms: 'ML-KEM-768 / ML-DSA-65 / SLH-DSA' };
  },

  async algorithms() {
    return { ok: true, algorithms: getAlgInfo() };
  },

  async scan({ content, filename, files } = {}) {
    let units = [];
    if (Array.isArray(files) && files.length) {
      units = files.filter((f) => typeof f?.content === 'string').map((f) => ({ filename: f.filename || 'file', content: f.content }));
    } else if (typeof content === 'string') {
      units = [{ filename: filename || 'pasted-input', content }];
    }
    if (!units.length) throw new Error('Provide `content` or a non-empty `files` array.');

    const { files: perFile, findings } = scanFiles(units);
    const pqcReady = units.some((u) => detectPqcReady(u.content));
    const score = computeScore(findings, { pqcReady });
    const roadmap = generateRoadmap(findings);
    return { ok: true, score, roadmap, findings, files: perFile, scannedAt: new Date().toISOString() };
  },

  async protect({ filename, dataBase64, recipientPublicKey } = {}) {
    if (typeof dataBase64 !== 'string' || !dataBase64.length) throw new Error('Provide file bytes as `dataBase64`.');
    const plaintext = fromB64(dataBase64);
    const result = await protectFile(plaintext, { filename, recipientPublicKey });

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
    return { ok: true, package: result.package, secretKey: result.secretKey, publicKey: result.publicKey, report };
  },

  async unprotect({ package: pkg, secretKey } = {}) {
    if (!pkg || typeof secretKey !== 'string') throw new Error('Provide the `package` object and base64 `secretKey`.');
    const { plaintext, filename, integrityOk } = await unprotectFile(pkg, secretKey);
    return { ok: true, filename, integrityOk, dataBase64: bytesToB64(plaintext), bytes: plaintext.length };
  },

  async keys(types) {
    const wanted = Array.isArray(types) && types.length ? types : ['kem', 'dsa', 'slh'];
    const generators = { kem, dsa, slh };
    const out = {};
    for (const t of wanted) {
      const g = generators[t];
      if (!g) continue;
      const kp = g.keygen();
      out[t] = {
        algorithm: g.name,
        standard: g.standard,
        purpose: g.purpose,
        guidance: KEY_GUIDANCE[t],
        publicKey: bytesToB64(kp.publicKey),
        secretKey: bytesToB64(kp.secretKey),
        sizes: { publicKey: kp.publicKey.length, secretKey: kp.secretKey.length },
      };
    }
    return {
      ok: true,
      keys: out,
      disclaimer:
        'These are post-quantum-ready keys. They do not automatically replace existing keys in your system — ' +
        'integrate them deliberately, keep secret keys offline/encrypted, and have the rollout reviewed.',
    };
  },
};

// --- File helpers (already client-side) ------------------------------------
export function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(file);
  });
}

export function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function downloadText(filename, text) {
  triggerDownload(filename, new Blob([text], { type: 'text/plain' }));
}
export function downloadJSON(filename, obj) {
  triggerDownload(filename, new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
}
export function downloadBase64(filename, b64, mime = 'application/octet-stream') {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  triggerDownload(filename, new Blob([bytes], { type: mime }));
}
function triggerDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
