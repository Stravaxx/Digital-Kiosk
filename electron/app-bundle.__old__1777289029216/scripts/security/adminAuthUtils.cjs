const crypto = require('crypto');

const PASSWORD_SCHEME = 'scrypt';
const KEY_LENGTH = 64;

function normalizeUsername(value) {
  return String(value || '').trim();
}

function hashPassword(rawPassword) {
  const password = String(rawPassword || '');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${PASSWORD_SCHEME}$${salt}$${hash}`;
}

function verifyPassword(rawPassword, storedHash) {
  const password = String(rawPassword || '');
  const packedHash = String(storedHash || '').trim();
  const [scheme, salt, expectedHash] = packedHash.split('$');

  if (scheme !== PASSWORD_SCHEME || !salt || !expectedHash) {
    return false;
  }

  const computedHash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const computedBuffer = Buffer.from(computedHash, 'hex');

  if (expectedBuffer.length !== computedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
}

function createAdminAccount(username, rawPassword) {
  const now = new Date().toISOString();
  return {
    username: normalizeUsername(username),
    passwordHash: hashPassword(rawPassword),
    createdAt: now,
    updatedAt: now,
    passwordAlgo: PASSWORD_SCHEME
  };
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  normalizeUsername,
  hashPassword,
  verifyPassword,
  createAdminAccount,
  generateSessionToken
};
