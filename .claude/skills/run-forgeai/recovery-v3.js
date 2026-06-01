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
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Remove leading backticks
  const lines = content.split('\n');
  const cleanedLines = lines.map(line => {
    if (line.startsWith('`')) {
      changed = true;
      return line.substring(1);
    }
    return line;
  });
  content = cleanedLines.join('\n');

  // 2. Find and fix template literals
  // We look for `return \`... \`;` or similar patterns.
  // Since these are mostly system prompts, we can use a regex to find
  // the large blocks that start with `return \` and end with \`;`

  const templateRegex = /return\s+`([\s\S]*?)`;/g;
  let match;
  while ((match = templateRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const innerContent = match[1];

    // Escape all backticks inside the inner content
    const escapedInner = innerContent.replace(/`/g, '\\`');
    if (escapedInner !== innerContent) {
      changed = true;
      content = content.replace(fullMatch, `return \`${escapedInner}\`;`);
    }
  }

  if (changed) {
    console.log(`Recovering ${filePath}...`);
    fs.writeFileSync(filePath, content);
  }
});

console.log('Sophisticated recovery complete.');
