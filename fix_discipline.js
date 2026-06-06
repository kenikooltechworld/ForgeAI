const fs = require('fs');
const path = 'src/extension/agents/spec/SpecWriterAgent.ts';
let content = fs.readFileSync(path, 'utf8');

const discipline = [
  '',
  '    prompt += `',
  '',
  '# OUTPUT DISCIPLINE',
  '- Output ONLY the filled-in markdown. Nothing else.',
  '- NO introduction, NO preamble, NO "Here is the spec..."',
  '- NO JSON, NO code fences wrapping the document, NO explanation text',
  '- Start directly with the exact title heading from the template',
  '- End silently after the last section',
  '`;'
].join('\n');

// 1) requirements builder
content = content.replace(
  /prompt \+=\ `\n--- END TEMPLATE ---\n\`;\n\n    return prompt;\n  \}\n\n  private buildContextSection/,
  `prompt += \`\\n--- END TEMPLATE ---\\n\`;${discipline}\n\n  }\n\n  private buildContextSection`
);

// 2) design builder
const designEnd = "prompt += this.deps.specManager.designTemplate().replace(/{SPEC_NAME}/g, title);\n    prompt += `\\n--- END TEMPLATE ---\\n`;\n\n    return prompt;\n  }\n\n  /**";
if (content.includes("prompt += this.deps.specManager.designTemplate().replace(/{SPEC_NAME}/g, title);")) {
  content = content.replace(
    "prompt += this.deps.specManager.designTemplate().replace(/{SPEC_NAME}/g, title);\n    prompt += `\\n--- END TEMPLATE ---\\n`;\n\n    return prompt;\n  }\n\n  /**",
    "prompt += this.deps.specManager.designTemplate().replace(/{SPEC_NAME}/g, title);\n    prompt += `\\n--- END TEMPLATE ---\\n`;" + discipline + "\n\n  }\n\n  /**"
  );
}

// 3) tasks builder
if (content.includes("prompt += this.deps.specManager.tasksTemplate().replace(/{SPEC_NAME}/g, title);")) {
  content = content.replace(
    "prompt += this.deps.specManager.tasksTemplate().replace(/{SPEC_NAME}/g, title);\n    prompt += `\\n--- END TEMPLATE ---\\n`;\n\n    return prompt;\n  }\n\n  private buildBugfixUserPrompt",
    "prompt += this.deps.specManager.tasksTemplate().replace(/{SPEC_NAME}/g, title);\n    prompt += `\\n--- END TEMPLATE ---\\n`;" + discipline + "\n\n  }\n\n  private buildBugfixUserPrompt"
  );
}

fs.writeFileSync(path, content);
console.log('Done');
