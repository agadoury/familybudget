/**
 * Household numbers travel in the repository only as an AES-256-GCM bundle whose key is derived
 * from a passphrase with scrypt. The passphrase is the first household password: entering it on
 * the deployed app decrypts the bundle and loads the real data. Pure node:crypto, no dependencies.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export interface EncryptedBundle {
  v: 1;
  kdf: "scrypt";
  N: number;
  salt: string; // base64
  iv: string; // base64
  tag: string; // base64
  data: string; // base64 ciphertext of UTF-8 JSON
}

const N = 1 << 15; // 32 MiB, ~50 ms per attempt

function key(passphrase: string, salt: Buffer, n: number): Buffer {
  return scryptSync(passphrase.normalize("NFKC"), salt, 32, { N: n, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export function encryptJson(value: unknown, passphrase: string): EncryptedBundle {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(passphrase, salt, N), iv);
  const data = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), "utf8")), cipher.final()]);
  return { v: 1, kdf: "scrypt", N, salt: salt.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

/** Returns null when the passphrase is wrong (GCM authentication fails). */
export function decryptJson<T>(bundle: EncryptedBundle, passphrase: string): T | null {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(passphrase, Buffer.from(bundle.salt, "base64"), bundle.N), Buffer.from(bundle.iv, "base64"));
    decipher.setAuthTag(Buffer.from(bundle.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(bundle.data, "base64")), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch {
    return null;
  }
}
