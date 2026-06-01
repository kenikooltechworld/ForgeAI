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
  const lines = content.split('\n');
  let changed = false;

  const cleanedLines = lines.map(line => {
    if (line.startsWith('`')) {
      changed = true;
      return line.substring(1);
    }
    return line;
  });

  if (changed) {
    console.log(`Fixing leading backticks in ${filePath}...`);
    fs.writeFileSync(filePath, cleanedLines.join('\n'));
  }
});

console.log('Leading backtick cleanup complete.');
