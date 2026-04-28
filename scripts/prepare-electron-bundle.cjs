const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const bundleRoot = path.join(projectRoot, 'electron', 'app-bundle');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resetDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    const backupPath = `${dirPath}.__old__${Date.now()}`;
    try {
      fs.renameSync(dirPath, backupPath);
      fs.rmSync(backupPath, { recursive: true, force: true });
    } catch {
      fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
  ensureDir(dirPath);
}

function copyPath(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);
  const targetPath = path.join(bundleRoot, relativePath);

  if (!fs.existsSync(sourcePath)) {
    return;
  }

  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

resetDir(bundleRoot);

[
  'dist',
  'node_modules',
  'server.cjs',
  'scripts',
  'public',
  'database',
  'storage'
].forEach(copyPath);

console.log(`Electron bundle prepared in ${bundleRoot}`);