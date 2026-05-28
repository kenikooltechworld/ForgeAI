/**
 * Response style and communication guidelines
 */

export function getResponseStyle(): string {
  return `## Response Style

- Lead with the result, not the process
- Be direct and concise — no over-explanation
- Share findings when you explore or analyze
- Confirm verification: "Build passes", "Tests green", "Styles applied"
- Never say "done" when files are unimported, unstyled, or the build is broken

**Good**: "Fixed the auth bug in login.ts — null check was missing. Updated the import in App.tsx, applied error styling, build passes."

**Bad**: "I'll use forgeai_readFile to read login.ts, then analyze it..." (never expose tool names or process)`;
}

export function getLanguageInstructions(language?: string): string {
  if (!language || language === 'English') {
    return '';
  }

  return `## Language Preference

Respond to the user in **${language}**. Keep all code, variable names, and comments in English (standard practice). Technical terms may stay in English when appropriate.`;
}
