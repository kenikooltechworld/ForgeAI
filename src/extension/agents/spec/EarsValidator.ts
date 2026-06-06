/**
 * EARS (Easy Approach to Requirements Syntax) Validator
 * Validates that acceptance criteria follow EARS notation patterns.
 */

export interface EarsValidationResult {
  line: number;
  text: string;
  valid: boolean;
  pattern?: string;
  issue?: string;
}

const EARS_PATTERNS = [
  // Ubiquitous
  { name: 'Ubiquitous', regex: /^\s*the\s+\w+\s+shall\s+/i },
  // Event-driven
  { name: 'Event-driven', regex: /^\s*when\s+.+?,?\s+the\s+\w+\s+shall\s+/i },
  // Unwanted behaviour
  { name: 'Unwanted behaviour', regex: /^\s*if\s+.+?,?\s+then\s+the\s+\w+\s+shall\s+/i },
  // Optional feature
  { name: 'Optional feature', regex: /^\s*where\s+.+?,?\s+the\s+\w+\s+shall\s+/i },
  // State-driven
  { name: 'State-driven', regex: /^\s*while\s+.+?,?\s+the\s+\w+\s+shall\s+/i },
];

export function validateEars(content: string): EarsValidationResult[] {
  const lines = content.split('\n');
  const results: EarsValidationResult[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Only validate lines that look like acceptance criteria (numbered lists, bullet points, or "AC:" prefix)
    if (!line.match(/^(-|\*|\d+\.|AC:\s*)/i)) continue;

    const text = line.replace(/^(-|\*|\d+\.|AC:\s*)/i, '').trim();
    if (!text) continue;

    let matched = false;
    for (const pattern of EARS_PATTERNS) {
      if (pattern.regex.test(text)) {
        results.push({ line: i + 1, text, valid: true, pattern: pattern.name });
        matched = true;
        break;
      }
    }

    if (!matched) {
      results.push({
        line: i + 1,
        text,
        valid: false,
        issue:
          'Does not match any EARS pattern. Expected one of: "The system shall...", "When..., the system shall...", "If..., then the system shall...", "Where..., the system shall...", "While..., the system shall..."',
      });
    }
  }

  return results;
}

export function formatEarsReport(results: EarsValidationResult[]): string {
  const validCount = results.filter((r) => r.valid).length;
  const total = results.length;
  const percentage = total > 0 ? Math.round((validCount / total) * 100) : 0;

  const lines = [
    `# EARS Validation Report`,
    '',
    `- **Valid:** ${validCount}/${total} (${percentage}%)`,
    `- **Invalid:** ${total - validCount}`,
    '',
    '## Results',
    '',
  ];

  for (const r of results) {
    const status = r.valid ? '✅' : '❌';
    const detail = r.valid ? `(${r.pattern})` : `— ${r.issue}`;
    lines.push(`${status} **Line ${r.line}:** ${r.text} ${detail}`);
  }

  if (results.length === 0) {
    lines.push('_No acceptance criteria lines found._');
  }

  return lines.join('\n');
}

