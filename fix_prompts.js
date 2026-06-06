const fs = require('fs');
const path = 'src/extension/agents/spec/SpecWriterAgent.ts';
let content = fs.readFileSync(path, 'utf8');

const outputDiscipline = `
    prompt += \`\\\\n# OUTPUT DISCIPLINE\\\\n\`;
    prompt += \`- Output ONLY the filled-in markdown. Nothing else.\\\\n\`;
    prompt += \`- NO introduction, NO preamble, NO "Here is the ..."\\\\n\`;
    prompt += \`- NO JSON, NO code fences wrapping the document, NO explanation text\\\\n\`;
    prompt += \`- Start directly with the exact document title\\\\n\`;
    prompt += \`- End after the last section — no trailing commentary\\\\n\`;
`;

// Fix requirements prompt builder
content = content.replace(
  /(prompt \+= `\\\\n--- END TEMPLATE ---\\\\n`;\n\n    return prompt;)/,
  `${outputDiscipline}\n    return prompt;`
);

// Fix design prompt builder
content = content.replace(
  /(Write the design document now following the EXACT template below\.\\\\n)(prompt \+= `Replace all \{placeholder\} content with real, specific content for "\$\{title\}"\.\\\\n`;\n    prompt \+= `Keep the exact heading levels, horizontal rules \(---\), and section order\.\\\\n`;\n    prompt \+= `Do NOT invent new sections or change the structure\.\\\\n\\\\n`;\n    prompt \+= `--- EXACT TEMPLATE TO FOLLOW ---\\\\n`;\n    prompt \+= this\.deps\.specManager\.designTemplate\(\)\.replace\(\/\{SPEC_NAME\}\/g, title\);\n    prompt \+= `\\\\n--- END TEMPLATE ---\\\\n`;\n\n    return prompt;)/,
  `$1$2`
);
// Design builder explicit replacement
const designMarker = `prompt += this.deps.specManager.designTemplate().replace(/{SPEC_NAME}/g, title);\n    prompt += \`\\\\n--- END TEMPLATE ---\\\\n\`;\n\n    return prompt;`;
if (content.includes(designMarker)) {
  content = content.replace(
    designMarker,
    `prompt += this.deps.specManager.designTemplate().replace(/{SPEC_NAME}/g, title);
    prompt += \`\\\\n--- END TEMPLATE ---\\\\n\`;
${outputDiscipline}
    return prompt;`
  );
}

// Fix tasks prompt builder
const tasksMarker = `prompt += this.deps.specManager.tasksTemplate().replace(/{SPEC_NAME}/g, title);\n    prompt += \`\\\\n--- END TEMPLATE ---\\\\n\`;\n\n    return prompt;`;
if (content.includes(tasksMarker)) {
  content = content.replace(
    tasksMarker,
    `prompt += this.deps.specManager.tasksTemplate().replace(/{SPEC_NAME}/g, title);
    prompt += \`\\\\n--- END TEMPLATE ---\\\\n\`;
${outputDiscipline}
    return prompt;`
  );
}

fs.writeFileSync(path, content);
console.log('Done');
