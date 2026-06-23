// ---------------------------------------------------------------------------
// pqc.js — Post-Quantum Cryptography layer (REAL, not demo).
//
// Backed by @noble/post-quantum (FIPS 203 / 204 / 205 implementations):
//   ML-KEM-768   (FIPS 203) — key encapsulation, protects symmetric keys
//   ML-DSA-65    (FIPS 204) — digital signatures
//   SLH-DSA      (FIPS 205) — hash-based signatures, high-security option
//
// This module is intentionally the ONLY place that talks to the PQC library,
// so the rest of the app stays crypto-agile: swap the library here and nothing
// else changes.
// ---------------------------------------------------------------------------
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { slh_dsa_sha2_128f } from '@noble/post-quantum/slh-dsa.js';

const u8 = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));

// --- ML-KEM-768: key encapsulation (protects the AES key) -------------------
export const kem = {
  name: 'ML-KEM-768',
  standard: 'FIPS 203',
  purpose: 'Key encapsulation — wraps/derives the symmetric key used to encrypt data.',
  keygen() {
    const { publicKey, secretKey } = ml_kem768.keygen();
    return { publicKey: u8(publicKey), secretKey: u8(secretKey) };
  },
  // Returns { cipherText, sharedSecret }. cipherText travels with the package;
  // sharedSecret is fed into HKDF to derive the AES key (see cryptoFile.js).
  encapsulate(publicKey) {
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(u8(publicKey));
    return { cipherText: u8(cipherText), sharedSecret: u8(sharedSecret) };
  },
  decapsulate(cipherText, secretKey) {
    return u8(ml_kem768.decapsulate(u8(cipherText), u8(secretKey)));
  },
};

// --- ML-DSA-65: lattice signatures -----------------------------------------
export const dsa = {
  name: 'ML-DSA-65',
  standard: 'FIPS 204',
  purpose: 'Digital signatures — proves authenticity/integrity of a message or file.',
  keygen() {
    const { publicKey, secretKey } = ml_dsa65.keygen();
    return { publicKey: u8(publicKey), secretKey: u8(secretKey) };
  },
  sign(message, secretKey) {
    return u8(ml_dsa65.sign(u8(message), u8(secretKey)));
  },
  verify(signature, message, publicKey) {
    return ml_dsa65.verify(u8(signature), u8(message), u8(publicKey));
  },
};

// --- SLH-DSA (SPHINCS+): conservative hash-based signatures -----------------
export const slh = {
  name: 'SLH-DSA-SHA2-128f',
  standard: 'FIPS 205',
  purpose: 'Hash-based signatures — slower/larger, but rests only on hash security.',
  keygen() {
    const { publicKey, secretKey } = slh_dsa_sha2_128f.keygen();
    return { publicKey: u8(publicKey), secretKey: u8(secretKey) };
  },
  sign(message, secretKey) {
    return u8(slh_dsa_sha2_128f.sign(u8(message), u8(secretKey)));
  },
  verify(signature, message, publicKey) {
    return slh_dsa_sha2_128f.verify(u8(signature), u8(message), u8(publicKey));
  },
};

// Metadata surfaced in the Key Upgrade UI so copy stays accurate to the impl.
export const ALG_INFO = {
  kem: { ...meta(kem), sizes: sizesOf(kem) },
  dsa: { ...meta(dsa), sizes: sizesOf(dsa) },
  slh: { ...meta(slh), sizes: sizesOf(slh) },
};

function meta(a) {
  return { name: a.name, standard: a.standard, purpose: a.purpose };
}
function sizesOf(a) {
  const k = a.keygen();
  const out = { publicKey: k.publicKey.length, secretKey: k.secretKey.length };
  if (a.encapsulate) {
    out.cipherText = a.encapsulate(k.publicKey).cipherText.length;
  } else if (a.sign) {
    out.signature = a.sign(new TextEncoder().encode('x'), k.secretKey).length;
  }
  return out;
}
