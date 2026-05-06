const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..');
const destDir = path.resolve(__dirname, 'www');

const itemsToCopy = [
  'index.html',
  'istruzioni-terminal-easter-egg.html',
  'istruzioni-versione-badge.html',
  'css',
  'js',
  'icons',
  'manifest.webmanifest',
  'service-worker.js',
  'design-test' // Might be needed for the UI
];

// Create www directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach(function(childItemName) {
      copyRecursiveSync(path.join(src, childItemName),
                        path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

itemsToCopy.forEach(item => {
  const srcPath = path.join(srcDir, item);
  const destPath = path.join(destDir, item);
  
  if (fs.existsSync(srcPath)) {
    console.log(`Copying ${item}...`);
    copyRecursiveSync(srcPath, destPath);
  } else {
    console.warn(`Warning: ${item} not found in root directory.`);
  }
});

console.log('Assets copied successfully to www directory.');
