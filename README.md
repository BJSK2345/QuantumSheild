# 🛡️ QuantumShield

**Scan for quantum-vulnerable cryptography and create post-quantum-ready encrypted packages.**

QuantumShield is a security tool that helps you become *post-quantum ready*. It finds risky
cryptography, explains why it's exposed, generates standardized post-quantum keys, and encrypts files
into hybrid quantum-resistant packages.

> **Honesty first.** QuantumShield does **not** make anything "100% quantum-proof," "impossible to
> decrypt," or "automatically fixed." It provides **risk assessment, post-quantum-ready key generation,
> hybrid encryption, and migration guidance.** Real security still depends on implementation, key
> storage, and a developer/security review.

This is **not** demo-mode crypto. The PQC layer uses real FIPS 203/204/205 implementations
(`@noble/post-quantum`): **ML-KEM-768, ML-DSA-65, and SLH-DSA**.

---

---

## 1. Architecture

```
                ┌──────────────────────────────┐
  Browser  ───► │  React + Vite client (:5173) │
                │  Dashboard · Scan · Protect   │
                │  Key Upgrade · Roadmap        │
                └───────────────┬──────────────┘
                       /api/*  (Vite proxy)
                                │
                ┌───────────────▼──────────────┐
                │  Node + Express API (:3001)   │
                │                               │
                │  scanner.js   rule engine     │
                │  scoring.js   risk score      │
                │  roadmap.js   migration plan  │
                │  cryptoFile.js  AES-256-GCM   │
                │  pqc.js  ◄── crypto-agile ──┐ │
                └─────────────────────────────┼─┘
                                              │
                              @noble/post-quantum (FIPS 203/204/205)
                              ML-KEM-768 · ML-DSA-65 · SLH-DSA
```

- **Stateless** — no database. Files and keys are processed in memory and returned to the browser.
- **Crypto-agile** — every PQC call goes through `server/lib/pqc.js`. Swap the library there and nothing
  else changes.

## 2. Folder structure

```
QSH/
├─ package.json            # root scripts: dev / dev:server / dev:client / build
├─ README.md
├─ server/
│  ├─ index.js             # Express app + API routes
│  ├─ package.json
│  └─ lib/
│     ├─ scanner.js        # regex rule engine
│     ├─ scoring.js        # 0–100 risk score
│     ├─ roadmap.js        # phased migration plan
│     ├─ cryptoFile.js     # AES-256-GCM + ML-KEM hybrid (KEM-DEM)
│     └─ pqc.js            # ML-KEM / ML-DSA / SLH-DSA wrapper (the agile seam)
└─ client/
   ├─ index.html
   ├─ vite.config.js       # proxies /api -> :3001
   ├─ package.json
   └─ src/
      ├─ main.jsx  App.jsx  api.js  index.css
      ├─ components/  Sidebar · RiskGauge · FindingCard · icons · ui
      └─ pages/       Dashboard · Scan · Protect · Keys · Roadmap
```

## 3. Backend API routes

| Method | Route             | Purpose |
|--------|-------------------|---------|
| GET    | `/api/health`     | Liveness + rule count. |
| GET    | `/api/algorithms` | PQC algorithm metadata & key sizes. |
| POST   | `/api/scan`       | Body `{ content }` or `{ files:[{filename,content}] }` → `{ findings, score, roadmap }`. |
| POST   | `/api/protect`    | Body `{ filename, dataBase64 }` → encrypted `package`, `secretKey`, `publicKey`, `report`. |
| POST   | `/api/unprotect`  | Body `{ package, secretKey }` → `{ dataBase64, filename, integrityOk }`. |
| POST   | `/api/keys`       | Body `{ types:['kem','dsa','slh'] }` → post-quantum key pairs + guidance. |

## 4. Scanner logic (rule-based)

Each rule is `{ id, pattern (RegExp), title, risk, category, explanation, migration }`. The scanner runs
every rule over the text, records each match with `line:column`, caps repeats per rule, and sorts by
severity. Categories: **quantum-vulnerable**, **classically-weak**, **bad-practice**.

Detected patterns include: `RSA`, `ECDSA/ECDH/ECC`, named curves (`secp256r1`, `prime256v1`, …),
`crypto.generateKeyPair`, `crypto.createSign/Verify`, `-----BEGIN … PRIVATE KEY-----`, AWS keys,
hardcoded secrets, `MD5`, `SHA-1`, `TLSv1.0/1.1` & SSL, `DES/3DES/RC4`, ECB mode, and `Math.random()`
for security. See `server/lib/scanner.js` to add rules — that's the only file you touch.

## 5. File encryption (AES-256-GCM, hybrid KEM-DEM)

`server/lib/cryptoFile.js`:

1. **ML-KEM-768** encapsulates a 32-byte shared secret to a recipient public key.
2. **HKDF-SHA256** derives a 256-bit AES key from that shared secret (+ random salt).
3. **AES-256-GCM** encrypts the file (12-byte IV, 16-byte auth tag).

The package stores the **KEM ciphertext**, not the key. Only the ML-KEM **secret key** holder can
decapsulate and decrypt. Decryption fails loudly on a wrong key or any tampering (GCM auth check + a
SHA-256 integrity check).

## 6. ML-KEM integration (real, and how to extend)

The PQC seam is `server/lib/pqc.js`, exposing `kem`, `dsa`, `slh` with `keygen / encapsulate /
decapsulate / sign / verify`. It is backed by `@noble/post-quantum` today. To move to another
implementation (e.g. `liboqs`/native bindings for production), reimplement those functions — **no other
file changes.** That's the crypto-agility the roadmap recommends, demonstrated in the code itself.

## 7. Risk scoring formula

`server/lib/scoring.js` — weights `Critical 40 / High 22 / Medium 10 / Low 4`. Repeats of the same rule
add 25% each (capped at 3×). The weighted sum **Σ** is squashed into 0–100:

```
riskScore = 100 · (1 − e^(−Σ / 60))     # higher = more risk
```

Detecting post-quantum / crypto-agile signals applies a 20% mitigation discount. The response also
breaks exposure into **quantum / classical / practice** sub-scores for the UI bars, plus a letter grade
(A–F).

## 8. React component structure

- `App.jsx` — layout shell, simple route state, shared scan result, backend-health polling.
- **Components:** `Sidebar`, `RiskGauge` (SVG glow gauge), `FindingCard`, `icons`, and `ui` (Panel,
  StatCard, RiskBadge, CategoryBadge, ExposureBar, CopyField, Toast, EmptyState, Spinner).
- **Pages:** `Dashboard`, `Scan`, `Protect`, `Keys`, `Roadmap`.

## 9. UI copy (per page)

- **Dashboard:** *"Get ahead of harvest now, decrypt later."* — explains Shor's algorithm + the
  does/doesn't honesty panel.
- **Scan:** *"Paste source/config or upload files… with a migration step for each finding."*
- **Protect:** *"Encrypt a file into a quantum-resistant package using a hybrid KEM-DEM scheme."*
- **Key Upgrade:** *"ML-KEM protects shared keys; ML-DSA/SLH-DSA are for signatures — they don't
  automatically replace every existing key."*
- **Roadmap:** *"A phased plan generated from your scan… require a developer/security review before
  production changes."*

## 10. Example scan output (abridged)

```json
{
  "score": { "riskScore": 98, "postureScore": 2, "grade": "F", "label": "Critical exposure",
    "totals": { "findings": 16, "byRisk": { "Critical": 1, "High": 10, "Medium": 4, "Low": 1 } },
    "exposure": { "quantum": 83, "classical": 66, "practice": 67 } },
  "findings": [
    { "ruleId": "private-key-block", "title": "Hardcoded private key", "risk": "Critical",
      "category": "bad-practice", "filename": "payments.js", "line": 21, "column": 1,
      "match": "-----BEGIN RSA PRIVATE KEY-----",
      "explanation": "A private key embedded in source/config can be extracted…",
      "migration": "Remove the key from code immediately, rotate it, and load secrets from a vault…" }
  ],
  "roadmap": { "summary": { "immediateActionRequired": true, "quantumMigrationNeeded": true,
    "triggeredSteps": 7, "totalSteps": 7 } }
}
```

## 11. Example encrypted package metadata

```json
{
  "version": "qs-pkg-1",
  "createdAt": "2026-06-22T18:00:00.000Z",
  "algorithms": { "kem": "ML-KEM-768 (FIPS 203)", "kdf": "HKDF-SHA256", "cipher": "AES-256-GCM" },
  "file": { "name": "secret.txt", "bytes": 32, "sha256": "…" },
  "kemCiphertext": "…base64 (1088 bytes)…",
  "kdfSalt": "…base64 (16 bytes)…",
  "iv": "…base64 (12 bytes)…",
  "authTag": "…base64 (16 bytes)…",
  "ciphertext": "…base64…",
  "notes": "Quantum-resistant hybrid package. Security depends on safe storage of the secret key."
}
```

## 12. Hackathon build plan

1. **Backend skeleton** — Express + `/api/health`. *(done)*
2. **Scanner + scoring** — rules, line numbers, 0–100 score. *(done)*
3. **PQC layer** — verify the library API, wire ML-KEM/ML-DSA/SLH-DSA. *(done)*
4. **Protect/unprotect** — AES-256-GCM hybrid + tamper test. *(done)*
5. **Frontend shell** — sidebar, theme, routing. *(done)*
6. **Wire each page** to its endpoint. *(done)*
7. **Polish** — gauge glow, badges, copy/download, honesty copy. *(done)*

## 13. Stretch features

- Hybrid **X25519 + ML-KEM** key exchange (classical + PQC together).
- Sign protected packages with **ML-DSA** and verify on decrypt.
- GitHub repo / folder scanning with a per-file heatmap and SARIF export.
- Severity-weighted **diff mode** (score before/after a fix).
- Drag-and-drop multi-file scanning; PDF report export.
- AST-based scanning (reduce regex false positives).

---

### Security notes & limitations
- Hackathon MVP — **not** audited for production. Have the design and key management reviewed.
- Secret keys are returned to the browser for the demo; in production keep them offline/encrypted.
- The scanner is pattern-based and can produce false positives/negatives — a human review is required.
- AES-256 is considered quantum-resistant (Grover only halves effective key strength); ML-KEM protects
  the key exchange that classical RSA/ECC would otherwise expose.
