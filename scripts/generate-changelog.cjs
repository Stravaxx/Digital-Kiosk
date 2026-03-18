#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function parseArgs(argv) {
  const options = {
    from: '',
    to: 'HEAD',
    output: 'CHANGELOG.md'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--from') {
      options.from = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (token === '--to') {
      options.to = String(argv[index + 1] || '').trim() || 'HEAD';
      index += 1;
      continue;
    }
    if (token === '--output') {
      options.output = String(argv[index + 1] || '').trim() || 'CHANGELOG.md';
      index += 1;
      continue;
    }
  }

  return options;
}

function runGit(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf-8');
}

function buildRange(from, to) {
  if (from) return `${from}..${to}`;
  return to;
}

function collectCommits(range) {
  const logRaw = runGit(`git log --pretty=format:__COMMIT__%n%H%n%s --name-only ${range}`);
  const lines = logRaw.split(/\r?\n/);
  const commits = [];
  let current = null;

  for (const line of lines) {
    if (line === '__COMMIT__') {
      if (current) commits.push(current);
      current = { sha: '', subject: '', files: [] };
      continue;
    }
    if (!current) continue;

    if (!current.sha) {
      current.sha = line.trim();
      continue;
    }
    if (!current.subject) {
      current.subject = line.trim();
      continue;
    }

    const file = line.trim();
    if (file) {
      current.files.push(file);
    }
  }

  if (current) commits.push(current);
  return commits.filter((entry) => entry.sha && entry.subject);
}

function toMarkdown({ from, to, commits }) {
  const now = new Date().toISOString();
  const fileMap = new Map();

  for (const commit of commits) {
    const uniqueFiles = Array.from(new Set(commit.files));
    for (const file of uniqueFiles) {
      if (!fileMap.has(file)) fileMap.set(file, new Set());
      fileMap.get(file).add(commit.subject);
    }
  }

  const fileEntries = Array.from(fileMap.entries()).sort((a, b) => a[0].localeCompare(b[0], 'fr'));

  const lines = [];
  lines.push('# Changelog');
  lines.push('');
  lines.push(`Généré automatiquement le ${now}.`);
  lines.push('');
  lines.push('## Périmètre');
  lines.push('');
  lines.push(`- Base: ${from || '(début de l\'historique)'}`);
  lines.push(`- Cible: ${to}`);
  lines.push(`- Commits: ${commits.length}`);
  lines.push(`- Fichiers impactés: ${fileEntries.length}`);
  lines.push('');

  lines.push('## Changements notables');
  lines.push('');
  if (commits.length === 0) {
    lines.push('- Aucun changement détecté sur la plage demandée.');
  } else {
    for (const commit of commits) {
      const shortSha = commit.sha.slice(0, 7);
      lines.push(`- ${commit.subject} (${shortSha})`);
    }
  }
  lines.push('');

  lines.push('## Détails par fichier');
  lines.push('');
  if (fileEntries.length === 0) {
    lines.push('- Aucun fichier modifié.');
  } else {
    for (const [file, subjects] of fileEntries) {
      lines.push(`### ${file}`);
      lines.push('');
      for (const subject of Array.from(subjects)) {
        lines.push(`- ${subject}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    execSync(`git config --global --add safe.directory "${process.cwd()}"`, { stdio: 'ignore' });
  } catch {
    // best effort
  }
  const range = buildRange(options.from, options.to);

  const commits = collectCommits(range);
  const markdown = toMarkdown({ from: options.from, to: options.to, commits });

  const outputPath = path.resolve(process.cwd(), options.output);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  process.stdout.write(`Changelog généré: ${outputPath}\n`);
}

main();
