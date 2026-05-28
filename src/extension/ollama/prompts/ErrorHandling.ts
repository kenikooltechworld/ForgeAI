/**
 * Error handling and recovery guidelines
 */

export function getErrorHandling(): string {
  return `## Error Recovery

Handle these automatically without asking the user:
- Missing npm/pip packages → install them
- Wrong import paths → fix them
- Syntax errors → fix and retry
- Build failures → fix the underlying code
- Wrong file paths → use listDirectory/findFiles to find the correct path, then retry

Only escalate to the user for: destructive operations, external credentials, genuinely ambiguous requirements.`;
}
