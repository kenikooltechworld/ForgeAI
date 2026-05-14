/**
 * UI/UX Architect Agent — Design System Webview Provider
 * Phase 2.6: Webview UI for design system preview
 * Requirements: 13.1, 13.5
 */

import * as vscode from 'vscode';
import { DesignSystemStorage } from './storage/DesignSystemStorage';
import { formatAsJSON, formatAsCSS, formatAsTailwind } from './storage/TokenFormatters';

export class UIUXWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'forgeai.uiux.designSystem';
  private view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly workspaceRoot: string
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'exportJson':
          await this.exportTokens('json');
          break;
        case 'exportCss':
          await this.exportTokens('css');
          break;
        case 'exportTailwind':
          await this.exportTokens('tailwind');
          break;
        case 'refresh':
          webviewView.webview.html = this.getHtml(webviewView.webview);
          break;
      }
    });
  }

  private async exportTokens(format: 'json' | 'css' | 'tailwind'): Promise<void> {
    const storage = new DesignSystemStorage(this.workspaceRoot);
    const tokens = storage.load();
    if (!tokens) {
      void vscode.window.showErrorMessage('No design system found. Create one first.');
      return;
    }

    let content: string;
    let filename: string;
    switch (format) {
      case 'json':
        content = formatAsJSON(tokens);
        filename = 'tokens.json';
        break;
      case 'css':
        content = formatAsCSS(tokens);
        filename = 'tokens.css';
        break;
      case 'tailwind':
        content = formatAsTailwind(tokens);
        filename = 'tailwind.config.js';
        break;
    }

    const uri = vscode.Uri.file(`${this.workspaceRoot}/.forgeai/design-system/${filename}`);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
    void vscode.window.showInformationMessage(`Exported ${filename}`);
  }

  private getHtml(webview: vscode.Webview): string {
    const storage = new DesignSystemStorage(this.workspaceRoot);
    const tokens = storage.load();
    const metadata = storage.loadMetadata();

    if (!tokens) {
      return this.renderEmptyState();
    }

    const nonce = this.getNonce();
    const colors = tokens.colors;
    const typography = tokens.typography;
    const spacing = tokens.spacing;
    const shadows = tokens.shadows;
    const semantic = tokens.semanticColors;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>${tokens.name}</title>
  <style>
    :root { --bg: var(--vscode-editor-background); --fg: var(--vscode-editor-foreground); }
    * { box-sizing: border-box; }
    body { font-family: var(--vscode-font-family); background: var(--bg); color: var(--fg); padding: 16px; margin: 0; }
    h1 { font-size: 1.5rem; margin: 0 0 8px; }
    h2 { font-size: 1.1rem; margin: 24px 0 12px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
    .subtitle { color: var(--vscode-descriptionForeground); font-size: 0.85rem; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
    .swatch { display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 6px; background: var(--vscode-editor-inactiveSelectionBackground); }
    .swatch-box { width: 100%; height: 48px; border-radius: 4px; border: 1px solid var(--vscode-panel-border); }
    .swatch-label { font-size: 0.7rem; margin-top: 4px; color: var(--vscode-descriptionForeground); }
    .swatch-value { font-size: 0.65rem; font-family: monospace; }
    .section { margin-bottom: 24px; }
    .type-sample { padding: 8px 0; border-bottom: 1px solid var(--vscode-panel-border); }
    .type-label { font-size: 0.7rem; color: var(--vscode-descriptionForeground); text-transform: uppercase; }
    .shadow-box { padding: 16px; margin: 8px 0; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px; text-align: center; }
    .btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; margin-right: 8px; }
    .btn:hover { opacity: 0.9; }
    .semantic-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .semantic-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px; font-size: 0.8rem; }
    .dot { width: 14px; height: 14px; border-radius: 50%; border: 1px solid var(--vscode-panel-border); }
  </style>
</head>
<body>
  <h1>${tokens.name}</h1>
  <div class="subtitle">v${tokens.version}${metadata ? ` — Last modified: ${new Date(metadata.modifiedAt).toLocaleDateString()}` : ''}</div>

  <div style="margin-bottom:16px;">
    <button class="btn" onclick="post('exportJson')">Export JSON</button>
    <button class="btn" onclick="post('exportCss')">Export CSS</button>
    <button class="btn" onclick="post('exportTailwind')">Export Tailwind</button>
    <button class="btn" onclick="post('refresh')">Refresh</button>
  </div>

  <div class="section">
    <h2>Semantic Colors</h2>
    ${this.renderSemanticColors(semantic as unknown as Record<string, Record<string, string>>)}
  </div>

  <div class="section">
    <h2>Color Scales</h2>
    ${this.renderColorScales(colors as unknown as Record<string, Record<string, string>>)}
  </div>

  <div class="section">
    <h2>Typography</h2>
    ${this.renderTypography(typography)}
  </div>

  <div class="section">
    <h2>Spacing</h2>
    <div class="grid">
      ${Object.entries(spacing.scale)
        .map(
          ([k, v]) =>
            `<div class="swatch"><div class="swatch-label">${k}</div><div class="swatch-value">${v}</div></div>`
        )
        .join('')}
    </div>
  </div>

  <div class="section">
    <h2>Shadows</h2>
    ${Object.entries(shadows.elevation)
      .map(([k, v]) => `<div class="shadow-box" style="box-shadow:${v}">${k}</div>`)
      .join('')}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function post(command) { vscode.postMessage({ command }); }
  </script>
</body>
</html>`;
  }

  private renderEmptyState(): string {
    return `<!DOCTYPE html><html><head><style>
      body { font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); padding: 24px; text-align: center; }
      h1 { font-size: 1.2rem; }
      p { color: var(--vscode-descriptionForeground); }
    </style></head><body>
      <h1>No Design System</h1>
      <p>Create a design system using the command palette:<br><strong>ForgeAI: UI/UX → Create Design System</strong></p>
    </body></html>`;
  }

  private renderSemanticColors(semantic: Record<string, Record<string, string>>): string {
    const categories = Object.entries(semantic);
    if (categories.length === 0) return '<p>No semantic colors defined.</p>';
    return categories
      .map(
        ([cat, values]) => `
      <h3 style="font-size:0.9rem;margin:12px 0 6px;text-transform:capitalize;">${cat}</h3>
      <div class="semantic-row">
        ${Object.entries(values)
          .map(
            ([k, v]) => `
          <div class="semantic-item"><div class="dot" style="background:${v}"></div>${k}</div>
        `
          )
          .join('')}
      </div>
    `
      )
      .join('');
  }

  private renderColorScales(colors: Record<string, Record<string, string>>): string {
    return Object.entries(colors)
      .map(
        ([name, scale]) => `
      <h3 style="font-size:0.9rem;margin:12px 0 6px;text-transform:capitalize;">${name}</h3>
      <div class="grid">
        ${Object.entries(scale)
          .map(
            ([weight, value]) => `
          <div class="swatch">
            <div class="swatch-box" style="background:${value}"></div>
            <div class="swatch-label">${weight}</div>
            <div class="swatch-value">${value}</div>
          </div>
        `
          )
          .join('')}
      </div>
    `
      )
      .join('');
  }

  private renderTypography(typography: {
    heading: Record<string, { size: string; weight: number }>;
    body: Record<string, { size: string }>;
    ui: Record<string, { size: string }>;
  }): string {
    return [
      '<h3 style="font-size:0.9rem;margin:12px 0 6px;">Headings</h3>',
      ...Object.entries(typography.heading).map(
        ([k, v]) => `
        <div class="type-sample" style="font-size:${v.size};font-weight:${v.weight}">
          <div class="type-label">${k}</div>
          ${k} — The quick brown fox
        </div>
      `
      ),
      '<h3 style="font-size:0.9rem;margin:12px 0 6px;">Body</h3>',
      ...Object.entries(typography.body).map(
        ([k, v]) => `
        <div class="type-sample" style="font-size:${v.size}">
          <div class="type-label">${k}</div>
          The quick brown fox jumps over the lazy dog.
        </div>
      `
      ),
      '<h3 style="font-size:0.9rem;margin:12px 0 6px;">UI</h3>',
      ...Object.entries(typography.ui).map(
        ([k, v]) => `
        <div class="type-sample" style="font-size:${v.size}">
          <div class="type-label">${k}</div>
          ${k} — Action, Label, Caption
        </div>
      `
      ),
    ].join('');
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
