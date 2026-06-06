/**
 * NoJunkDocsFilter
 *
 * Injects a rule into AI context to prohibit auto-generated documentation comments.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import * as vscode from 'vscode';

export class NoJunkDocsFilter {
  constructor(private readonly personaManager: { isNoJunkDocsEnabled(): boolean }) {}

  public getSystemInjection(): string | null {
    if (!this.personaManager.isNoJunkDocsEnabled()) return null;
    return `
## No Junk Docs Rule (ACTIVE)
Do NOT generate JSDoc, docstrings, XML documentation comments, or auto-generated API documentation.
Inline comments explaining complex logic are still allowed.
`;
  }

  public async toggle(enabled: boolean): Promise<void> {
    await vscode.workspace.getConfiguration('forgeai').update('noJunkDocs', enabled, vscode.ConfigurationTarget.Global);
  }
}
