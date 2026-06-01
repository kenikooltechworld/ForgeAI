const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/extension/spec/SpecTaskExecutor.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the leading backticks that were accidentally added to every line
const lines = content.split('\n');
const cleanedLines = lines.map(line => {
  if (line.startsWith('`')) {
    return line.substring(1);
  }
  return line;
});
content = cleanedLines.join('\n');

// Fix the escaped backticks in template literals
content = content.replace(/\\`/g, '`');

fs.writeFileSync(filePath, content);
console.log('Fixed SpecTaskExecutor.ts');
