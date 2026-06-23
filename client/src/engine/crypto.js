// ---------------------------------------------------------------------------
// crypto.js — Hybrid post-quantum file protection (KEM-DEM), in the browser.
//
//   1. ML-KEM-768 encapsulates a 32-byte shared secret to a recipient pubkey.
//   2. HKDF-SHA256 derives a 256-bit AES key (Web Crypto SubtleCrypto).
//   3. AES-256-GCM encrypts the file (authenticated encryption).
//
// Produces the same "qs-pkg-1" package format as the original server build,
// so packages are interchangeable. Quantum-RESISTANT, not "quantum-proof".
// ---------------------------------------------------------------------------
import { kem } from './pqc.js';
import { bytesToB64, fromB64 } from './bytes.js';

const subtle = globalThis.crypto.subtle;
const HKDF_INFO = new TextEncoder().encode('QuantumShield/ML-KEM-768+AES-256-GCM/v1');
const PACKAGE_VERSION = 'qs-pkg-1';

function randomBytes(n) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

async function sha256hex(bytes) {
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Derive a 256-bit AES-GCM key from the KEM shared secret via HKDF-SHA256.
async function deriveAesKey(sharedSecret, salt) {
  const base = await subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Protect a file. If no recipientPublicKey is supplied, a fresh ML-KEM keypair
 * is generated and its secret key is returned so the user can store it.
 * @param {Uint8Array} plaintext
 */
export async function protectFile(plaintext, { filename = 'file.bin', recipientPublicKey } = {}) {
  let publicKey, secretKey;
  if (recipientPublicKey) {
    publicKey = recipientPublicKey instanceof Uint8Array ? recipientPublicKey : fromB64(recipientPublicKey);
    secretKey = null;
  } else {
    const kp = kem.keygen();
    publicKey = kp.publicKey;
    secretKey = kp.secretKey;
  }

  const { cipherText: kemCiphertext, sharedSecret } = kem.encapsulate(publicKey);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const aesKey = await deriveAesKey(sharedSecret, salt);

  // Web Crypto AES-GCM appends the 16-byte auth tag to the output; split it
  // out so the package matches the original {ciphertext, authTag} format.
  const combined = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, aesKey, plaintext));
  const ciphertext = combined.slice(0, combined.length - 16);
  const authTag = combined.slice(combined.length - 16);

  const pkg = {
    version: PACKAGE_VERSION,
    createdAt: new Date().toISOString(),
    algorithms: { kem: 'ML-KEM-768 (FIPS 203)', kdf: 'HKDF-SHA256', cipher: 'AES-256-GCM' },
    file: { name: filename, bytes: plaintext.length, sha256: await sha256hex(plaintext) },
    kemCiphertext: bytesToB64(kemCiphertext),
    kdfSalt: bytesToB64(salt),
    iv: bytesToB64(iv),
    authTag: bytesToB64(authTag),
    ciphertext: bytesToB64(ciphertext),
    notes:
      'Quantum-resistant hybrid package. Recover by decapsulating kemCiphertext ' +
      'with the matching ML-KEM-768 secret key, then AES-256-GCM decrypt. ' +
      'Security depends on safe storage of the secret key.',
  };

  return {
    package: pkg,
    secretKey: secretKey ? bytesToB64(secretKey) : null,
    publicKey: bytesToB64(publicKey),
  };
}

/**
 * Reverse protectFile. Throws on a wrong key or tampering (GCM auth failure).
 */
export async function unprotectFile(pkg, secretKeyB64) {
  if (!pkg || pkg.version !== PACKAGE_VERSION) {
    throw new Error('Unrecognized or unsupported package format.');
  }
  const secretKey = fromB64(secretKeyB64);

  let sharedSecret;
  try {
    sharedSecret = kem.decapsulate(fromB64(pkg.kemCiphertext), secretKey);
  } catch {
    throw new Error('Decryption failed: wrong secret key or the package was modified.');
  }

  const aesKey = await deriveAesKey(sharedSecret, fromB64(pkg.kdfSalt));
  const ct = fromB64(pkg.ciphertext);
  const tag = fromB64(pkg.authTag);
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct, 0);
  combined.set(tag, ct.length);

  let plaintext;
  try {
    plaintext = new Uint8Array(
      await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(pkg.iv), tagLength: 128 }, aesKey, combined)
    );
  } catch {
    throw new Error('Decryption failed: wrong secret key or the package was modified.');
  }

  const integrityOk = !pkg.file?.sha256 || (await sha256hex(plaintext)) === pkg.file.sha256;
  return { plaintext, filename: pkg.file?.name || 'recovered.bin', integrityOk };
}
