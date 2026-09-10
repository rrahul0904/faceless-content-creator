import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'v1';

function encryptionKey() {
  const secret = process.env.SOCIAL_TOKEN_KEY || process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SOCIAL_TOKEN_KEY (or APP_SECRET) must be configured with at least 16 characters before storing social credentials');
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptToken(value: string) {
  if (!value) throw new Error('Cannot encrypt an empty token');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptToken(value: string | null | undefined) {
  if (!value) return null;
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = value.split('.');
  if (version !== PREFIX || !ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error('Stored social token has an unsupported encryption format');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function tokenStorageReady() {
  const secret = process.env.SOCIAL_TOKEN_KEY || process.env.APP_SECRET;
  return Boolean(secret && secret.length >= 16);
}
