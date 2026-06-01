const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, callback);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      callback(filePath);
    }
  });
}

walk('src', (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Remove leading backticks
  const lines = content.split('\n');
  let cleanedLines = lines.map(line => {
    if (line.startsWith('`')) {
      changed = true;
      return line.substring(1);
    }
    return line;
  });
  let newContent = cleanedLines.join('\n');

  // 2. Fix escaped backticks in template literals
  if (newContent.includes('\\`')) {
    changed = true;
    newContent = newContent.replace(/\\`/g, '`');
  }

  if (changed) {
    console.log(`Fixing ${filePath}...`);
    fs.writeFileSync(filePath, newContent);
  }
});

console.log('Global cleanup complete.');
