#!/usr/bin/env node

const { spawn } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const projectDir = path.join(repoRoot, 'Digital Kiosk Manager');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/flutter-manager.cjs <flutter args...>');
  process.exit(1);
}

const child = spawn('flutter', args, {
  cwd: projectDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});