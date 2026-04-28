#!/usr/bin/env node

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const DOCS_API_DIR = path.join(ROOT, 'docs-api');
const PUBLIC_DOCS_DIR = path.join(ROOT, 'public', 'docs');
const PUBLIC_API_DIR = path.join(PUBLIC_DOCS_DIR, 'api');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`Commande échouée: ${command} ${args.join(' ')}`);
  }
}

async function removeIfExists(target) {
  if (fs.existsSync(target)) {
    await fsp.rm(target, { recursive: true, force: true });
  }
}

async function main() {
  await removeIfExists(DOCS_API_DIR);
  await removeIfExists(PUBLIC_DOCS_DIR);
  run('npx', ['typedoc', '--options', 'typedoc.json']);

  run('npx', ['vitepress', 'build', 'docs']);

  await removeIfExists(PUBLIC_API_DIR);
  await fsp.mkdir(PUBLIC_DOCS_DIR, { recursive: true });
  await fsp.cp(DOCS_API_DIR, PUBLIC_API_DIR, { recursive: true, force: true });

  console.log('\n[OK] Documentation générée: public/docs');
  console.log('[OK] API générée: public/docs/api');
}

main().catch((error) => {
  console.error(`[ERREUR] ${String(error?.message || error)}`);
  process.exit(1);
});
