// ---------------------------------------------------------------------------
// cryptoFile.js — Hybrid post-quantum file protection (KEM-DEM construction).
//
//   1. ML-KEM-768 encapsulates a 32-byte shared secret to a recipient pubkey.
//   2. HKDF-SHA256 derives a 256-bit AES key from that shared secret.
//   3. AES-256-GCM encrypts the file (authenticated encryption).
//
// The package carries the KEM ciphertext, not the key itself. Only the holder
// of the ML-KEM secret key can recover the shared secret and decrypt. This is
// the same KEM-DEM pattern used by real PQC hybrid schemes.
//
// HONESTY: this is quantum-RESISTANT, not "quantum-proof". Real-world security
// still depends on secret-key storage, implementation review, and using a
// vetted ML-KEM build in production.
// ---------------------------------------------------------------------------
import crypto from 'node:crypto';
import { kem } from './pqc.js';

const HKDF_INFO = Buffer.from('QuantumShield/ML-KEM-768+AES-256-GCM/v1');
const PACKAGE_VERSION = 'qs-pkg-1';

const b64 = (buf) => Buffer.from(buf).toString('base64');
const fromB64 = (s) => Buffer.from(s, 'base64');

// Derive a 256-bit AES key from the KEM shared secret.
function deriveAesKey(sharedSecret, salt) {
  // Node's HKDF returns an ArrayBuffer; wrap it as a Buffer.
  return Buffer.from(crypto.hkdfSync('sha256', sharedSecret, salt, HKDF_INFO, 32));
}

/**
 * Protect a file. If no recipientPublicKey is supplied, a fresh ML-KEM keypair
 * is generated and the secret key is returned so the user can store it safely.
 *
 * @param {Buffer} plaintext        raw file bytes
 * @param {object} opts
 * @param {string} [opts.filename]
 * @param {Buffer} [opts.recipientPublicKey] existing ML-KEM public key
 * @returns {{ package: object, secretKey: string|null, publicKey: string }}
 */
export function protectFile(plaintext, { filename = 'file.bin', recipientPublicKey } = {}) {
  let publicKey, secretKey;
  if (recipientPublicKey) {
    publicKey = fromB64(recipientPublicKey instanceof Buffer ? b64(recipientPublicKey) : recipientPublicKey);
    secretKey = null; // caller already holds it
  } else {
    const kp = kem.keygen();
    publicKey = Buffer.from(kp.publicKey);
    secretKey = Buffer.from(kp.secretKey);
  }

  const { cipherText: kemCiphertext, sharedSecret } = kem.encapsulate(publicKey);

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12); // 96-bit nonce, recommended for GCM
  const aesKey = deriveAesKey(sharedSecret, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const pkg = {
    version: PACKAGE_VERSION,
    createdAt: new Date().toISOString(),
    algorithms: {
      kem: 'ML-KEM-768 (FIPS 203)',
      kdf: 'HKDF-SHA256',
      cipher: 'AES-256-GCM',
    },
    file: {
      name: filename,
      bytes: plaintext.length,
      sha256: crypto.createHash('sha256').update(plaintext).digest('hex'),
    },
    kemCiphertext: b64(kemCiphertext),
    kdfSalt: b64(salt),
    iv: b64(iv),
    authTag: b64(authTag),
    ciphertext: b64(ciphertext),
    notes:
      'Quantum-resistant hybrid package. Recover by decapsulating kemCiphertext ' +
      'with the matching ML-KEM-768 secret key, then AES-256-GCM decrypt. ' +
      'Security depends on safe storage of the secret key.',
  };

  return {
    package: pkg,
    secretKey: secretKey ? b64(secretKey) : null,
    publicKey: b64(publicKey),
  };
}

/**
 * Reverse protectFile. Throws if the secret key is wrong or the package was
 * tampered with (GCM auth failure) — which is the desired behavior.
 *
 * @param {object} pkg            the package object produced by protectFile
 * @param {string} secretKeyB64   base64 ML-KEM-768 secret key
 * @returns {{ plaintext: Buffer, filename: string, integrityOk: boolean }}
 */
export function unprotectFile(pkg, secretKeyB64) {
  if (!pkg || pkg.version !== PACKAGE_VERSION) {
    throw new Error('Unrecognized or unsupported package format.');
  }
  const secretKey = fromB64(secretKeyB64);
  const sharedSecret = kem.decapsulate(fromB64(pkg.kemCiphertext), secretKey);
  const aesKey = deriveAesKey(sharedSecret, fromB64(pkg.kdfSalt));

  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, fromB64(pkg.iv));
  decipher.setAuthTag(fromB64(pkg.authTag));

  let plaintext;
  try {
    plaintext = Buffer.concat([decipher.update(fromB64(pkg.ciphertext)), decipher.final()]);
  } catch {
    // Wrong key or tampered data both surface here as a GCM auth failure.
    throw new Error('Decryption failed: wrong secret key or the package was modified.');
  }

  const integrityOk =
    !pkg.file?.sha256 ||
    crypto.createHash('sha256').update(plaintext).digest('hex') === pkg.file.sha256;

  return { plaintext, filename: pkg.file?.name || 'recovered.bin', integrityOk };
}
