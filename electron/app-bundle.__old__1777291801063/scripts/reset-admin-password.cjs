#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const readline = require('readline');
const { createAdminAccount, normalizeUsername } = require('./security/adminAuthUtils.cjs');

const ROOT = process.cwd();
const DB_DIR = path.resolve(ROOT, process.env.SYSTEM_DB_DIR || 'database');
const DB_PATH = path.join(DB_DIR, 'system-db.json');
const SQLITE_DB_PATH = path.join(DB_DIR, 'system.db');
const ADMIN_ACCOUNT_KV_KEY = 'ds.security.admin-account';
const ADMIN_USERS_KV_KEY = 'ds.security.admin-users';

let BetterSqlite3 = null;
try {
  BetterSqlite3 = require('better-sqlite3');
} catch {
  BetterSqlite3 = null;
}

function isStrongPassword(password) {
  const value = String(password || '');
  return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value);
}

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  if (hidden) {
    rl._writeToOutput = function _writeToOutput() {
      rl.output.write('*');
    };
  }

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function readDb() {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      kv: parsed?.kv && typeof parsed.kv === 'object' ? parsed.kv : {},
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      config: parsed?.config && typeof parsed.config === 'object' ? parsed.config : {},
      collections: parsed?.collections && typeof parsed.collections === 'object' ? parsed.collections : {},
      assets: Array.isArray(parsed?.assets) ? parsed.assets : [],
      schemaVersion: Number(parsed?.schemaVersion) || 2
    };
  } catch {
    return { kv: {}, users: [], config: {}, collections: {}, assets: [], schemaVersion: 2 };
  }
}

async function writeDb(db) {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

  if (BetterSqlite3) {
    try {
      const sqlite = new BetterSqlite3(SQLITE_DB_PATH);
      sqlite.pragma('journal_mode = WAL');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS system_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      sqlite.prepare(`
        INSERT INTO system_state (id, payload, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `).run(JSON.stringify(db), new Date().toISOString());
      sqlite.close();
    } catch {
      // fallback JSON only
    }
  }
}

function parseAdminUsers(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function upsertAdminUser(users, account) {
  const list = Array.isArray(users) ? [...users] : [];
  const index = list.findIndex((item) => normalizeUsername(item?.username) === account.username);
  const now = new Date().toISOString();
  const entry = {
    username: account.username,
    passwordHash: account.passwordHash,
    createdAt: list[index]?.createdAt || account.createdAt || now,
    updatedAt: now,
    passwordAlgo: account.passwordAlgo || 'scrypt'
  };

  if (index >= 0) {
    list[index] = { ...list[index], ...entry };
  } else {
    list.push(entry);
  }

  return list;
}

async function main() {
  const usernameInput = await ask('Nom d\'utilisateur admin: ');
  const username = normalizeUsername(usernameInput);
  if (!username) {
    throw new Error('Nom d\'utilisateur invalide.');
  }

  const password = await ask('Nouveau mot de passe (>= 8 caractères): ', { hidden: true });
  const confirmation = await ask('Confirmer le mot de passe: ', { hidden: true });

  if (password !== confirmation) {
    throw new Error('Les mots de passe ne correspondent pas.');
  }

  if (!isStrongPassword(password)) {
    throw new Error('Le mot de passe doit contenir 8+ caractères, avec au moins 1 minuscule et 1 majuscule.');
  }

  const db = await readDb();
  const account = createAdminAccount(username, password);
  db.kv[ADMIN_ACCOUNT_KV_KEY] = JSON.stringify(account);
  const users = upsertAdminUser(parseAdminUsers(db.kv[ADMIN_USERS_KV_KEY]), account);
  db.kv[ADMIN_USERS_KV_KEY] = JSON.stringify(users);
  db.users = users;
  await writeDb(db);

  console.log(`Compte admin réinitialisé pour l'utilisateur: ${username}`);
  console.log(`Base mise à jour: ${DB_PATH}`);
}

main().catch((error) => {
  console.error(`[ERREUR] ${String(error?.message || error)}`);
  process.exit(1);
});
