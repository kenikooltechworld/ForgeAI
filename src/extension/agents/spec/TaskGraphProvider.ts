/**
 * Task Dependency Graph Provider
 * Visualizes tasks and their dependencies as a directed graph.
 */

import * as vscode from 'vscode';
import { TaskManager } from '../../forgeaiWorkspace/TaskManager';

export class TaskGraphProvider {
  public static readonly viewType = 'forgeai.taskGraph';
  private panel?: vscode.WebviewPanel;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly tasks: TaskManager
  ) {}

  public show(specId: string): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.panel.webview.html = this.getHtml(specId);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      TaskGraphProvider.viewType,
      `Task Graph: ${specId}`,
      vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [this.context.extensionUri] }
    );

    this.panel.webview.html = this.getHtml(specId);
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private getHtml(specId: string): string {
    const tasks = this.tasks.parseTasks(specId);
    const nodes = tasks.map((t, i) => ({
      id: t.id,
      label: t.description.slice(0, 40) + (t.description.length > 40 ? '…' : ''),
      status: t.status,
      phase: t.phase,
      x: 80 + (i % 4) * 180,
      y: 60 + Math.floor(i / 4) * 120,
    }));

    const edges: { from: string; to: string }[] = [];
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        edges.push({ from: depId, to: task.id });
      }
    }

    const nodeData = JSON.stringify(nodes);
    const edgeData = JSON.stringify(edges);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Graph</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --border: var(--vscode-panel-border, #3c3c3c);
      --primary: var(--vscode-button-background, #0e639c);
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
      padding: 20px;
      overflow: auto;
    }
    h1 { margin: 0 0 16px; font-size: 18px; }
    .subtitle { color: var(--muted); margin-bottom: 20px; }
    svg { width: 100%; min-height: 600px; }
    .node rect {
      rx: 4;
      stroke-width: 1.5;
    }
    .node text {
      font-size: 11px;
      fill: var(--fg);
    }
    .node.done rect { fill: rgba(78,201,176,0.15); stroke: var(--success); }
    .node.pending rect { fill: rgba(14,99,156,0.15); stroke: var(--primary); }
    .node.in_progress rect { fill: rgba(204,167,0,0.15); stroke: var(--warning); }
    .node.failed rect { fill: rgba(244,135,113,0.15); stroke: var(--danger); }
    .edge path {
      fill: none;
      stroke: var(--muted);
      stroke-width: 1.5;
    }
    .edge arrow { fill: var(--muted); }
    .legend { display: flex; gap: 16px; margin-bottom: 20px; font-size: 12px; }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .legend-box { width: 14px; height: 14px; border-radius: 3px; border: 1.5px solid; }
  </style>
</head>
<body>
  <h1>Task Dependency Graph</h1>
  <div class="subtitle">${tasks.length} task${tasks.length !== 1 ? 's' : ''} — ${specId}</div>
  <div class="legend">
    <div class="legend-item"><div class="legend-box" style="background:rgba(78,201,176,0.15);border-color:var(--success)"></div> Done</div>
    <div class="legend-item"><div class="legend-box" style="background:rgba(14,99,156,0.15);border-color:var(--primary)"></div> Pending</div>
    <div class="legend-item"><div class="legend-box" style="background:rgba(204,167,0,0.15);border-color:var(--warning)"></div> In Progress</div>
    <div class="legend-item"><div class="legend-box" style="background:rgba(244,135,113,0.15);border-color:var(--danger)"></div> Failed</div>
  </div>
  <svg id="graph"></svg>
  <script>
    const nodes = ${nodeData};
    const edges = ${edgeData};
    const svg = document.getElementById('graph');
    const ns = 'http://www.w3.org/2000/svg';

    function createEl(tag, attrs) {
      const el = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
      return el;
    }

    const nodeW = 140, nodeH = 50;

    // Draw edges first (behind nodes)
    edges.forEach(e => {
      const from = nodes.find(n => n.id === e.from);
      const to = nodes.find(n => n.id === e.to);
      if (!from || !to) return;
      const x1 = from.x + nodeW / 2, y1 = from.y + nodeH;
      const x2 = to.x + nodeW / 2, y2 = to.y;
      const path = createEl('path', { d: \`M\${x1},\${y1} C\${x1},\${y1+30} \${x2},\${y2-30} \${x2},\${y2}\` });
      const g = createEl('g', { class: 'edge' });
      g.appendChild(path);
      // Arrowhead
      const arrow = createEl('polygon', { points: \`\${x2},\${y2} \${x2-4},\${y2-8} \${x2+4},\${y2-8}\`, class: 'arrow' });
      g.appendChild(arrow);
      svg.appendChild(g);
    });

    // Draw nodes
    nodes.forEach(n => {
      const g = createEl('g', { class: \`node \${n.status}\`, transform: \`translate(\${n.x},\${n.y})\` });
      const rect = createEl('rect', { width: nodeW, height: nodeH, rx: 4 });
      const text = createEl('text', { x: nodeW/2, y: nodeH/2 + 4, 'text-anchor': 'middle' });
      text.textContent = n.label;
      g.appendChild(rect);
      g.appendChild(text);
      svg.appendChild(g);
    });

    // Resize SVG
    const maxX = Math.max(...nodes.map(n => n.x + nodeW), 400);
    const maxY = Math.max(...nodes.map(n => n.y + nodeH), 300);
    svg.setAttribute('viewBox', \`0 0 \${maxX} \${maxY}\`);
  </script>
</body>
</html>`;
  }
}
