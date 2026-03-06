import * as crypto from 'crypto';

const PASSWORD_KEYLEN = 64;

export function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .scryptSync(password, actualSalt, PASSWORD_KEYLEN)
    .toString('hex');

  return `${actualSalt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, savedHash] = storedHash.split(':');
  if (!salt || !savedHash) {
    return false;
  }

  const derivedHash = crypto
    .scryptSync(password, salt, PASSWORD_KEYLEN)
    .toString('hex');

  const savedBuffer = Buffer.from(savedHash, 'hex');
  const derivedBuffer = Buffer.from(derivedHash, 'hex');
  if (savedBuffer.length !== derivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(savedBuffer, derivedBuffer);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function buildLegacyAdminToken(username: string, password: string): string {
  return crypto.createHash('sha256').update(`${username}:${password}`).digest('hex');
}
