/**
 * Spec Overview Provider — Central dashboard showing all specs, phases, coverage
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SpecManager } from '../../forgeaiWorkspace/SpecManager';
import { ForgeAIWorkspace } from '../../forgeaiWorkspace/ForgeAIWorkspace';

export class SpecOverviewProvider {
  public static readonly viewType = 'forgeai.specOverview';
  private panel?: vscode.WebviewPanel;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly workspace: ForgeAIWorkspace
  ) {}

  public show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.refresh();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      SpecOverviewProvider.viewType,
      'ForgeAI Spec Overview',
      vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [this.context.extensionUri] }
    );

    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'openSpec':
          await vscode.commands.executeCommand(
            'forgeai.spec.openPhase',
            message.specId,
            message.phase
          );
          break;
        case 'continueSpec':
          await vscode.commands.executeCommand('forgeai.spec.continue', message.specId);
          break;
        case 'approveSpec':
          await vscode.commands.executeCommand('forgeai.spec.approve', message.specId);
          break;
        case 'refresh':
          this.refresh();
          break;
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  public refresh(): void {
    if (this.panel) {
      this.panel.webview.html = this.getHtml();
    }
  }

  private getHtml(): string {
    const specs = this.workspace.spec.listSpecs();
    const cards = specs.map((spec) => this.renderSpecCard(spec)).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ForgeAI Spec Overview</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --border: var(--vscode-panel-border, #3c3c3c);
      --primary: var(--vscode-button-background, #0e639c);
      --primary-hover: var(--vscode-button-hoverBackground, #1177bb);
      --success: #4ec9b0;
      --warning: #cca700;
      --danger: #f48771;
      --muted: var(--vscode-descriptionForeground, #858585);
    }
    body {
      font-family: var(--vscode-font-family), sans-serif;
      background: var(--bg);
      color: var(--fg);
      margin: 0;
      padding: 24px;
    }
    h1 { margin: 0 0 16px; font-size: 22px; }
    .subtitle { color: var(--muted); margin-bottom: 24px; }
    .toolbar { display: flex; gap: 8px; margin-bottom: 24px; }
    button {
      background: var(--primary);
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover { background: var(--primary-hover); }
    button.secondary { background: transparent; border: 1px solid var(--border); color: var(--fg); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
    .card {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      background: var(--bg);
    }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .card-title { font-weight: 600; font-size: 15px; }
    .badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .badge-draft { background: var(--warning); color: #000; }
    .badge-active { background: var(--primary); color: #fff; }
    .badge-complete { background: var(--success); color: #000; }
    .phases { display: flex; gap: 6px; margin: 12px 0; }
    .phase {
      flex: 1;
      text-align: center;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      border: 1px solid var(--border);
      cursor: pointer;
    }
    .phase.done { background: rgba(78,201,176,0.15); border-color: var(--success); }
    .phase.pending { background: rgba(204,167,0,0.15); border-color: var(--warning); }
    .phase.missing { opacity: 0.4; }
    .actions { display: flex; gap: 8px; margin-top: 12px; }
    .actions button { flex: 1; font-size: 12px; padding: 4px 8px; }
    .empty { text-align: center; padding: 60px 20px; color: var(--muted); }
  </style>
</head>
<body>
  <h1>Spec Overview</h1>
  <div class="subtitle">${specs.length} spec${specs.length !== 1 ? 's' : ''} in workspace</div>
  <div class="toolbar">
    <button onclick="post('refresh')">Refresh</button>
    <button class="secondary" onclick="post('continueSpec', {specId: ''})">Continue Spec</button>
  </div>
  ${specs.length === 0 ? '<div class="empty">No specs yet. Use "Create Spec" to get started.</div>' : `<div class="grid">${cards}</div>`}
  <script>
    const vscode = acquireVsCodeApi();
    function post(command, data = {}) {
      vscode.postMessage({ command, ...data });
    }
  </script>
</body>
</html>`;
  }

  private renderSpecCard(spec: ReturnType<SpecManager['listSpecs']>[number]): string {
    const phases = ['requirements', 'design', 'tasks'] as const;
    const phaseStates = phases
      .map((p) => {
        const isDone = spec.phasesCompleted.includes(p);
        const isPending = spec.pendingApproval === p;
        const cls = isDone ? 'done' : isPending ? 'pending' : 'missing';
        const label = isDone ? '✓' : isPending ? '⏳' : '○';
        return `<div class="phase ${cls}" onclick="post('openSpec', {specId:'${spec.id}', phase:'${p}'})" title="${p}">${label} ${p}</div>`;
      })
      .join('');

    const statusClass = spec.status === 'complete' ? 'badge-complete' : 'badge-active';

    const actions: string[] = [];
    if (spec.pendingApproval) {
      actions.push(
        `<button onclick="post('approveSpec', {specId:'${spec.id}'})">Approve ${spec.pendingApproval}</button>`
      );
    } else if (spec.status !== 'complete') {
      actions.push(
        `<button onclick="post('continueSpec', {specId:'${spec.id}'})">Continue</button>`
      );
    }

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${spec.title}</span>
          <span class="badge ${statusClass}">${spec.status}</span>
        </div>
        <div class="phases">${phaseStates}</div>
        <div class="actions">${actions.join('')}</div>
      </div>
    `;
  }
}
