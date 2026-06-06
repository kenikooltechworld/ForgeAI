const fs = require('fs');
const path = 'src/extension/agents/spec/SpecWriterAgent.ts';
let content = fs.readFileSync(path, 'utf8');

const outputDiscipline = `
    prompt += \`\\\\n# OUTPUT DISCIPLINE\\\\n\`;
    prompt += \`- Output ONLY the filled-in markdown. Nothing else.\\\\n\`;
    prompt += \`- NO introduction, NO preamble, NO explanations\\\\n\`;
    prompt += \`- NO code fences around the document\\\\n\`;
    prompt += \`- Start directly with the document title\\\\n\`;
    prompt += \`- End silently after the last section\\\\n\`;
`;

// 1. Fix requirements builder
content = content.replace(
  /prompt \+=\ `\\\\n--- END TEMPLATE ---\\\\n\`;\n\n    return prompt;\n  \}\n\n  private buildContextSection/,
  `prompt += \\`\\\\n--- END TEMPLATE ---\\\\n\\`;
${outputDiscipline}
  }
  
  private buildContextSection`
);

// 2. Fix design builder
const designEnd = `prompt += this.deps.specManager.designTemplate().replace(/{SPEC_NAME}/g, title);\n    prompt += \\\`\\\\n--- END TEMPLATE ---\\\\n\\\`;\n\n    return prompt;\n  }\n\n  /**`;
if (content.includes(designEnd)) {
  content = content.replace(designEnd, 
    `prompt += this.deps.specManager.designTemplate().replace(/{SPEC_NAME}/g, title);
    prompt += \\\`\\\\n--- END TEMPLATE ---\\\\n\\\`;
${outputDiscipline}
  }
  
  /**`);
}

// 3. Fix tasks builder
const tasksEnd = `prompt += this.deps.specManager.tasksTemplate().replace(/{SPEC_NAME}/g, title);\n    prompt += \\\`\\\\n--- END TEMPLATE ---\\\\n\\\`;\n\n    return prompt;\n  }\n\n  private buildBugfixUserPrompt`;
if (content.includes(tasksEnd)) {
  content = content.replace(tasksEnd,
    `prompt += this.deps.specManager.tasksTemplate().replace(/{SPEC_NAME}/g, title);
    prompt += \\\`\\\\n--- END TEMPLATE ---\\\\n\\\`;
${outputDiscipline}
  }
  
  private buildBugfixUserPrompt`);
}

fs.writeFileSync(path, content);
console.log('Done');
