// ---------------------------------------------------------------------------
// roadmap.js — Turns scan findings into a phased, practical migration plan.
// Steps are always returned in order; `triggered` marks the ones the scan
// actually found evidence for, so the UI can highlight what matters now.
// ---------------------------------------------------------------------------
import { CATEGORIES } from './scanner.js';

export function generateRoadmap(findings = []) {
  const has = (pred) => findings.some(pred);
  const count = (pred) => findings.filter(pred).length;

  const hasHardcoded = has((f) => ['private-key-block', 'aws-key', 'generic-secret'].includes(f.ruleId));
  const hasQuantum = has((f) => f.category === CATEGORIES.QUANTUM);
  const hasClassical = has((f) => f.category === CATEGORIES.CLASSICAL);
  const hasMd5Sha1 = has((f) => ['md5', 'sha1'].includes(f.ruleId));
  const hasTls = has((f) => f.ruleId === 'legacy-tls');
  const hasWeakCipher = has((f) => ['weak-cipher', 'ecb-mode'].includes(f.ruleId));

  const steps = [
    {
      phase: 'Phase 0 — Contain',
      title: 'Rotate and remove exposed secrets',
      priority: hasHardcoded ? 'urgent' : 'as-needed',
      triggered: hasHardcoded,
      why: 'Hardcoded keys/secrets should be treated as already compromised.',
      actions: [
        'Revoke and rotate every exposed key, token, and credential.',
        'Strip secrets from source and git history; load them from a vault/env at runtime.',
      ],
      relatedFindings: count((f) => ['private-key-block', 'aws-key', 'generic-secret'].includes(f.ruleId)),
    },
    {
      phase: 'Phase 1 — Inventory',
      title: 'Build a cryptographic inventory',
      priority: 'recommended',
      triggered: findings.length > 0,
      why: 'You cannot migrate what you have not catalogued. A crypto bill-of-materials is the foundation.',
      actions: [
        'List every algorithm, key, certificate, and protocol version in use.',
        'Tag each by category (quantum-vulnerable, classically-weak, OK) and owner.',
      ],
      relatedFindings: findings.length,
    },
    {
      phase: 'Phase 2 — Remediate classical weaknesses',
      title: 'Remove MD5/SHA-1, weak ciphers, and legacy TLS',
      priority: hasClassical ? 'high' : 'as-needed',
      triggered: hasClassical,
      why: 'These are broken today, independent of quantum computing — fix them first for quick wins.',
      actions: [
        hasMd5Sha1 ? 'Replace MD5/SHA-1 with SHA-256/SHA-3; use Argon2id/bcrypt for passwords.' : 'Confirm no MD5/SHA-1 remain.',
        hasTls ? 'Disable TLS 1.0/1.1 and SSL; require TLS 1.2+ (prefer 1.3).' : 'Verify TLS 1.2+ is enforced.',
        hasWeakCipher ? 'Replace DES/3DES/RC4/ECB with AES-256-GCM.' : 'Confirm only AEAD ciphers are used.',
      ],
      relatedFindings: count((f) => f.category === CATEGORIES.CLASSICAL),
    },
    {
      phase: 'Phase 3 — Crypto-agility',
      title: 'Abstract algorithms behind configuration',
      priority: 'recommended',
      triggered: true,
      why: 'Agility lets you swap algorithms (including to PQC) without rewriting application logic.',
      actions: [
        'Route crypto through a single module/interface; select algorithms via config, not hardcoded calls.',
        'Add automated tests that pin algorithm choices so regressions are caught.',
      ],
      relatedFindings: 0,
    },
    {
      phase: 'Phase 4 — Symmetric baseline',
      title: 'Standardize on AES-256-GCM',
      priority: 'recommended',
      triggered: true,
      why: 'AES-256 is considered quantum-resistant (Grover only halves the effective key strength).',
      actions: [
        'Use AES-256-GCM (or ChaCha20-Poly1305) for data-at-rest and in-transit payloads.',
        'Ensure unique nonces/IVs and authenticated encryption everywhere.',
      ],
      relatedFindings: 0,
    },
    {
      phase: 'Phase 5 — Post-quantum migration',
      title: 'Hybridize RSA/ECC and adopt PQC standards',
      priority: hasQuantum ? 'high' : 'recommended',
      triggered: hasQuantum,
      why: 'Defends against "harvest now, decrypt later" by adding quantum-resistant algorithms alongside classical ones.',
      actions: [
        'Replace/hybridize key exchange with ML-KEM-768 (FIPS 203).',
        'Add ML-DSA-65 (FIPS 204) signatures; use SLH-DSA (FIPS 205) where a conservative option is required.',
        'Start with the most sensitive, long-lived data first.',
      ],
      relatedFindings: count((f) => f.category === CATEGORIES.QUANTUM),
    },
    {
      phase: 'Phase 6 — Review & validate',
      title: 'Security review before production',
      priority: 'required',
      triggered: true,
      why: 'PQC libraries, key storage, and protocol changes must be reviewed and tested — tooling output is a starting point, not a guarantee.',
      actions: [
        'Have a security engineer review the design and key-management plan.',
        'Run interop, performance, and rollback testing; monitor after rollout.',
      ],
      relatedFindings: 0,
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      immediateActionRequired: hasHardcoded,
      quantumMigrationNeeded: hasQuantum,
      classicalFixesNeeded: hasClassical,
      triggeredSteps: steps.filter((s) => s.triggered).length,
      totalSteps: steps.length,
    },
    steps,
  };
}
