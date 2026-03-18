#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const options = {
    input: 'CHANGELOG.md',
    output: 'RELEASE_NOTES.md',
    version: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--input') {
      options.input = String(argv[index + 1] || '').trim() || 'CHANGELOG.md';
      index += 1;
      continue;
    }
    if (token === '--output') {
      options.output = String(argv[index + 1] || '').trim() || 'RELEASE_NOTES.md';
      index += 1;
      continue;
    }
    if (token === '--version') {
      options.version = String(argv[index + 1] || '').trim();
      index += 1;
    }
  }

  return options;
}

function normalizeVersion(version) {
  const raw = String(version || '').trim();
  if (!raw) return '';
  return raw.startsWith('v') || raw.startsWith('V') ? `v${raw.slice(1)}` : `v${raw}`;
}

function extractSection(markdown, version) {
  const normalizedVersion = normalizeVersion(version);
  if (!normalizedVersion) {
    throw new Error('Version de release manquante.');
  }

  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('## ')) return false;
    const heading = trimmed.slice(3).trim();
    const versionToken = heading.split(/\s+-\s+/, 1)[0].trim();
    return normalizeVersion(versionToken).toLowerCase() === normalizedVersion.toLowerCase();
  });

  if (startIndex === -1) {
    throw new Error(`Section introuvable dans le changelog pour ${normalizedVersion}.`);
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex).join('\n').trim() + '\n';
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), options.input);
  const outputPath = path.resolve(process.cwd(), options.output);
  const markdown = fs.readFileSync(inputPath, 'utf-8');
  const notes = extractSection(markdown, options.version);
  fs.writeFileSync(outputPath, `${notes}`, 'utf-8');
  process.stdout.write(`Release notes générées: ${outputPath}\n`);
}

main();
