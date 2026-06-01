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
  // Replace triple backticks with escaped triple backticks
  if (content.includes('```')) {
    console.log(`Escaping triple backticks in ${filePath}...`);
    const newContent = content.replace(/```/g, '\\`\\`\\`');
    fs.writeFileSync(filePath, newContent);
  }
});

console.log('Triple backtick escaping complete.');
