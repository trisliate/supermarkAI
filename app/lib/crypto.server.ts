import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is not set");
  // Accept hex string (64 chars = 32 bytes) or raw 32-byte string
  if (key.length === 64) return Buffer.from(key, "hex");
  if (key.length === 32) return Buffer.from(key, "utf-8");
  throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars or 32 raw chars)");
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encryptedText: string): string {
  // Check if this looks like an encrypted value (iv:tag:ciphertext format)
  const parts = encryptedText.split(":");
  if (parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p))) {
    const [ivHex, tagHex, dataHex] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final("utf-8");
  }
  // Legacy plain-text key — return as-is
  return encryptedText;
}
