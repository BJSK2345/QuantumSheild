// ---------------------------------------------------------------------------
// scanner.js — Rule-based cryptography risk scanner (runs in the browser).
// Pure JS / regex; identical logic to the original server engine.
// ---------------------------------------------------------------------------

export const CATEGORIES = {
  QUANTUM: 'quantum-vulnerable',
  CLASSICAL: 'classically-weak',
  PRACTICE: 'bad-practice',
};

export const RISK_WEIGHT = { Critical: 40, High: 22, Medium: 10, Low: 4 };

export const RULES = [
  {
    id: 'rsa',
    pattern: /\bRSA(?:[- ]?(?:1024|2048|3072|4096))?\b/gi,
    title: 'RSA public-key cryptography',
    risk: 'High',
    category: CATEGORIES.QUANTUM,
    explanation:
      "RSA's security rests on integer factorization, which Shor's algorithm solves efficiently on a large quantum computer. Data protected today can be captured now and decrypted later (\"harvest now, decrypt later\").",
    migration: 'Move key establishment to ML-KEM-768, or run a hybrid (RSA + ML-KEM) during transition.',
  },
  {
    id: 'ecc',
    pattern: /\b(?:ECDSA|ECDH|ECDHE|ECIES|ECC|elliptic[- ]?curve)\b/gi,
    title: 'Elliptic-curve cryptography (ECC/ECDSA/ECDH)',
    risk: 'High',
    category: CATEGORIES.QUANTUM,
    explanation:
      "Elliptic-curve schemes rely on the discrete-log problem, also broken by Shor's algorithm. ECC keys are smaller than RSA but offer no quantum resistance.",
    migration: 'Use ML-KEM for key exchange and ML-DSA/SLH-DSA for signatures; hybridize during migration.',
  },
  {
    id: 'named-curves',
    pattern: /\b(?:secp256r1|secp384r1|secp521r1|secp256k1|prime256v1|P-256|P-384|P-521|Curve25519|X25519|ed25519)\b/gi,
    title: 'Named elliptic curve',
    risk: 'High',
    category: CATEGORIES.QUANTUM,
    explanation:
      'Standard NIST/Edwards curves are quantum-vulnerable. Their presence signals ECC-based key exchange or signatures that a quantum adversary could break.',
    migration: 'Plan replacement with post-quantum KEM/signature algorithms; keep classical curves only inside a hybrid.',
  },
  {
    id: 'node-keypair',
    pattern: /crypto\.generateKeyPair(?:Sync)?\s*\(/g,
    title: 'Asymmetric key-pair generation',
    risk: 'Medium',
    category: CATEGORIES.QUANTUM,
    explanation:
      'Key-pair generation usually produces RSA or EC keys, both quantum-vulnerable. Confirm the algorithm and key sizes used here.',
    migration: 'Make the algorithm configurable (crypto-agility) and add a post-quantum option via a PQC library.',
  },
  {
    id: 'node-sign',
    pattern: /crypto\.create(?:Sign|Verify)\s*\(/g,
    title: 'Classical signing / verification',
    risk: 'Medium',
    category: CATEGORIES.QUANTUM,
    explanation:
      'createSign/createVerify typically wrap RSA or ECDSA signatures, which a quantum computer could forge by recovering the private key.',
    migration: 'Add ML-DSA (FIPS 204) signatures, or SLH-DSA (FIPS 205) where a conservative hash-based scheme is preferred.',
  },
  {
    id: 'private-key-block',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
    title: 'Hardcoded private key',
    risk: 'Critical',
    category: CATEGORIES.PRACTICE,
    explanation:
      'A private key embedded in source/config can be extracted by anyone with read access and is likely already compromised. If it is an RSA/EC key it is also quantum-vulnerable.',
    migration: 'Remove the key from code immediately, rotate it, and load secrets from a vault or environment at runtime.',
  },
  {
    id: 'aws-key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    title: 'Hardcoded AWS access key ID',
    risk: 'Critical',
    category: CATEGORIES.PRACTICE,
    explanation: 'An AWS access key ID in source is a credential leak that can lead to full account compromise.',
    migration: 'Revoke the key, rotate credentials, and use IAM roles or a secrets manager instead of static keys.',
  },
  {
    id: 'generic-secret',
    pattern: /\b(?:api[_-]?key|secret|passwd|password|token|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*['"][^'"\n]{6,}['"]/gi,
    title: 'Hardcoded secret / credential',
    risk: 'High',
    category: CATEGORIES.PRACTICE,
    explanation:
      'Secrets assigned to string literals tend to end up in version control and build artifacts, where they are easy to harvest.',
    migration: 'Move the value to an environment variable or secrets manager and rotate the exposed secret.',
  },
  {
    id: 'md5',
    pattern: /\bMD5\b/gi,
    title: 'MD5 hash',
    risk: 'High',
    category: CATEGORIES.CLASSICAL,
    explanation:
      'MD5 is collision-broken and unsafe for signatures, integrity, or password hashing — independent of quantum computing.',
    migration: 'Use SHA-256/SHA-3 for integrity and Argon2id/bcrypt/scrypt for passwords.',
  },
  {
    id: 'sha1',
    pattern: /\bSHA-?1\b/gi,
    title: 'SHA-1 hash',
    risk: 'High',
    category: CATEGORIES.CLASSICAL,
    explanation: 'SHA-1 has practical collision attacks and is deprecated for certificates and signatures.',
    migration: 'Replace with SHA-256 or SHA-3. Re-issue any SHA-1 certificates or signatures.',
  },
  {
    id: 'legacy-tls',
    pattern: /\b(?:TLSv1(?:\.[01])?|SSLv2|SSLv3|TLS_?1_?[01])\b/gi,
    title: 'Outdated TLS/SSL version',
    risk: 'Medium',
    category: CATEGORIES.CLASSICAL,
    explanation:
      'TLS 1.0/1.1 and all SSL versions are deprecated and vulnerable to known downgrade/cipher attacks.',
    migration: 'Require TLS 1.2+ (prefer TLS 1.3) and disable legacy protocol versions at the server.',
  },
  {
    id: 'weak-cipher',
    pattern: /\b(?:DES|3DES|TripleDES|DES-EDE3|RC4|ARCFOUR|Blowfish)\b/gi,
    title: 'Weak/legacy symmetric cipher',
    risk: 'High',
    category: CATEGORIES.CLASSICAL,
    explanation: 'These ciphers have small block/key sizes or known biases and are unsafe for modern use.',
    migration: 'Use AES-256-GCM (or ChaCha20-Poly1305) for authenticated symmetric encryption.',
  },
  {
    id: 'ecb-mode',
    pattern: /\b(?:aes-(?:128|192|256)-ecb|[A-Za-z0-9]*ECB)\b/gi,
    title: 'ECB block-cipher mode',
    risk: 'Medium',
    category: CATEGORIES.CLASSICAL,
    explanation: 'ECB mode leaks plaintext patterns because identical blocks encrypt identically.',
    migration: 'Use an authenticated mode such as GCM; never use ECB for real data.',
  },
  {
    id: 'insecure-random',
    pattern: /Math\.random\s*\(\s*\)/g,
    title: 'Non-cryptographic randomness',
    risk: 'Low',
    category: CATEGORIES.PRACTICE,
    explanation:
      'Math.random() is predictable and must never seed keys, IVs, tokens, or salts.',
    migration: 'Use crypto.randomBytes() / crypto.getRandomValues() for any security-relevant randomness.',
  },
];

const MAX_HITS_PER_RULE = 25;

function lineColAt(text, index) {
  let line = 1;
  let lastNl = -1;
  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') {
      line++;
      lastNl = i;
    }
  }
  return { line, column: index - lastNl };
}

export function scanContent({ filename = 'pasted-input', content = '' }) {
  const findings = [];
  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m;
    let hits = 0;
    while ((m = re.exec(content)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const { line, column } = lineColAt(content, m.index);
      findings.push({
        ruleId: rule.id,
        title: rule.title,
        risk: rule.risk,
        category: rule.category,
        explanation: rule.explanation,
        migration: rule.migration,
        match: m[0].slice(0, 80),
        filename,
        line,
        column,
      });
      if (++hits >= MAX_HITS_PER_RULE) break;
    }
  }
  findings.sort(
    (a, b) => RISK_WEIGHT[b.risk] - RISK_WEIGHT[a.risk] || a.line - b.line
  );
  return { filename, findings };
}

export function scanFiles(files = []) {
  const perFile = files.map(scanContent);
  const allFindings = perFile.flatMap((f) => f.findings);
  return { files: perFile, findings: allFindings };
}
