import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.ENCRYPTION_SECRET;
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  if (!SECRET_KEY) {
    throw new Error('ENCRYPTION_SECRET is not set in the environment variables.');
  }
  if (SECRET_KEY.length !== 64) {
    throw new Error('ENCRYPTION_SECRET must be a 64-character hex string (32 bytes).');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(SECRET_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Payload format: iv:encryptedText:authTag
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

export function decrypt(payload: string): string {
  if (!SECRET_KEY) {
    throw new Error('ENCRYPTION_SECRET is not set in the environment variables.');
  }
  if (SECRET_KEY.length !== 64) {
    throw new Error('ENCRYPTION_SECRET must be a 64-character hex string (32 bytes).');
  }

  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected iv:encryptedText:authTag');
  }

  const [ivHex, encryptedTextHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(SECRET_KEY, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedTextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
