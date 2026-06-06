/**
 * HITLHandoffManager
 * Smart Assistance Requests — Human-in-the-Loop notification system.
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7
 */

import * as vscode from 'vscode';
import { ExecutableTask } from './types';

export type HITLCategory = 'authentication' | 'secrets' | 'decisions' | 'clarifications' | 'validation-failure';

export interface HITLRequest {
  id: string;
  taskId: string;
  taskDescription: string;
  phase: string;
  category: HITLCategory;
  message: string;
  context: {
    whatAIWasTrying: string;
    whatWentWrong: string;
    whatIsNeeded: string;
    codeSnippet?: string;
    stackTrace?: string;
    attemptedFixes?: Array<{ strategy: string; result: string }>;
  };
  suggestions: Array<{ title: string; description: string }>;
  documentationLinks?: Array<{ title: string; url: string }>;
  feedback?: 'helpful' | 'unhelpful' | 'skipped';
  timestamp: number;
  timeoutMs: number;
  status: 'pending' | 'awaiting-response' | 'resolved' | 'dismissed' | 'timeout';
  response?: string;
}

export class HITLHandoffManager {
  private readonly requests: HITLRequest[] = [];
  private readonly pendingQueue: HITLRequest[] = [];
  private readonly context: vscode.ExtensionContext;
  private readonly timeoutMs: number;
  private readonly maxRetries = 3;

  constructor(context: vscode.ExtensionContext, timeoutMs = 10 * 60 * 1000) {
    this.context = context;
    this.timeoutMs = timeoutMs;
  }

  public async requestAssistance(
    task: ExecutableTask,
    category: HITLCategory,
    message: string,
    details: {
      whatAIWasTrying: string;
      whatWentWrong: string;
      whatIsNeeded: string;
      codeSnippet?: string;
      stackTrace?: string;
      attemptedFixes?: Array<{ strategy: string; result: string }>;
      suggestions?: Array<{ title: string; description: string }>;
      documentationLinks?: Array<{ title: string; url: string }>;
    }
  ): Promise<HITLRequest | null> {
    const request: HITLRequest = {
      id: `hitl-${task.id}-${Date.now()}`,
      taskId: task.id,
      taskDescription: task.description,
      phase: `Phase ${task.phase}`,
      category,
      message,
      context: {
        whatAIWasTrying: details.whatAIWasTrying,
        whatWentWrong: details.whatWentWrong,
        whatIsNeeded: details.whatIsNeeded,
        codeSnippet: details.codeSnippet,
        stackTrace: details.stackTrace,
        attemptedFixes: details.attemptedFixes,
      },
      suggestions: details.suggestions?.length
        ? details.suggestions
        : this.getDefaultSuggestions(category),
      documentationLinks: details.documentationLinks,
      timestamp: Date.now(),
      timeoutMs: this.timeoutMs,
      status: 'pending',
    };

    this.requests.push(request);
    this.pendingQueue.push(request);
    this.processQueue();
    return request;
  }

  private async processQueue(): Promise<void> {
    if (this.pendingQueue.length === 0) return;
    const request = this.pendingQueue.shift()!;
    request.status = 'awaiting-response';
    const response = await this.showAssistancePanel(request);
    if (response !== null) {
      request.response = response;
      request.status = 'resolved';
    } else {
      request.status = 'dismissed';
    }
  }

  private async showAssistancePanel(request: HITLRequest): Promise<string | null> {
    const attemptedFixesHtml = request.context.attemptedFixes?.length
      ? `<div style="margin-top:12px"><strong>Attempted Fixes:</strong><ul>${request.context.attemptedFixes.map((f) => `<li><em>${f.strategy}</em>: ${f.result}</li>`).join('')}</ul></div>`
      : '';
    const codeHtml = request.context.codeSnippet
      ? `<div style="margin-top:12px"><strong>Code:</strong><pre style="background:#1e1e1e;padding:10px;border-radius:6px;overflow:auto">${this.escapeHtml(request.context.codeSnippet)}</pre></div>`
      : '';
    const stackHtml = request.context.stackTrace
      ? `<div style="margin-top:12px"><strong>Stack Trace:</strong><pre style="background:#1e1e1e;padding:10px;border-radius:6px;overflow:auto;font-size:11px">${this.escapeHtml(request.context.stackTrace)}</pre></div>`
      : '';
    const suggestionsHtml = request.suggestions.length
      ? `<div style="margin-top:12px"><strong>Suggested Solutions:</strong><ul>${request.suggestions.map((s) => `<li><button class="suggestion-btn" data-value="${this.escapeHtml(s.title)}">${this.escapeHtml(s.title)}</button> — ${this.escapeHtml(s.description)}</li>`).join('')}</ul></div>`
      : '';
    const docsHtml = request.documentationLinks?.length
      ? `<div style="margin-top:12px"><strong>Documentation:</strong><ul>${request.documentationLinks.map((d) => `<li><a href="${this.escapeHtml(d.url)}" target="_blank">${this.escapeHtml(d.title)}</a></li>`).join('')}</ul></div>`
      : '';

    const panel = vscode.window.createWebviewPanel(
      'forgeai.hitlSmartRequest',
      `Assistance Required — ${request.taskId}`,
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: false }
    );

    panel.webview.html = this.getAssistanceHtml(request, codeHtml, stackHtml, attemptedFixesHtml, suggestionsHtml, docsHtml);

    return new Promise((resolve) => {
      const disposable = panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'HITL_RESOLVED') {
          disposable.dispose();
          panel.dispose();
          void this.recordFeedback(request, message.feedback);
          resolve(message.response ?? null);
        } else if (message.type === 'HITL_DISMISSED') {
          disposable.dispose();
          panel.dispose();
          request.status = 'dismissed';
          resolve(null);
        } else if (message.type === 'HITL_FEEDBACK') {
          void this.recordFeedback(request, message.feedback);
        }
      });
    });
  }

  private async recordFeedback(request: HITLRequest, feedback?: string): Promise<void> {
    request.feedback = (feedback as HITLRequest['feedback']) || 'skipped';
    try {
      const globalState = this.context.globalState;
      const key = `forgeai.hitl.feedback.${request.taskId}`;
      await globalState.update(key, { requestId: request.id, feedback: request.feedback, timestamp: Date.now() });
    } catch {
      // non-blocking
    }
  }

  private getDefaultSuggestions(category: HITLCategory): Array<{ title: string; description: string }> {
    switch (category) {
      case 'authentication':
        return [
          { title: 'Provide 2FA code manually', description: 'Enter the 2FA code from your authenticator app' },
          { title: 'Skip authentication for now', description: 'Continue without auth and fill later' },
          { title: 'Use environment variable', description: 'Load credentials from env var or secret manager' },
        ];
      case 'secrets':
        return [
          { title: 'Enter API key now', description: 'Provide the key via secure input' },
          { title: 'Load from secret manager', description: 'Retrieve from Secret_Manager if previously stored' },
          { title: 'Skip this step', description: 'Continue without the secret and handle later' },
        ];
      case 'decisions':
        return [
          { title: 'Use recommended approach', description: 'Accept AI-recommended architecture' },
          { title: 'Choose alternative', description: 'Pick a different approach from suggestions' },
          { title: 'Pause for manual design', description: 'Stop AI and design this section manually' },
        ];
      case 'clarifications':
        return [
          { title: 'Clarify requirement', description: 'Provide more detail about the expected behavior' },
          { title: 'Accept best guess', description: 'Let AI proceed with its interpretation' },
          { title: 'Skip this requirement', description: 'Defer this feature to a later task' },
        ];
      default:
        return [
          { title: 'Retry automatically', description: 'Let AI attempt the fix again' },
          { title: 'Apply suggested fix', description: 'Manually apply the suggested solution' },
          { title: 'Skip and continue', description: 'Mark as resolved and continue' },
        ];
    }
  }

  private getAssistanceHtml(
    request: HITLRequest,
    codeHtml: string,
    stackHtml: string,
    attemptedFixesHtml: string,
    suggestionsHtml: string,
    docsHtml: string
  ): string {
    const timeoutSeconds = Math.ceil(request.timeoutMs / 1000);
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); padding: 20px; }
    h1 { color: var(--vscode-inputValidation-warningForeground); margin-top: 0; }
    .meta { background: var(--vscode-editor-inactiveSelectionBackground); padding: 12px; border-radius: 6px; margin-bottom: 16px; }
    .section { margin-top: 14px; }
    .section-title { font-weight: bold; margin-bottom: 6px; }
    textarea { width: 100%; height: 90px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 8px; border-radius: 4px; font-family: monospace; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 14px; border-radius: 4px; cursor: pointer; margin-right: 8px; margin-top: 8px; }
    button:hover { opacity: 0.92; }
    .suggestion-btn { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); display: block; width: 100%; text-align: left; margin: 6px 0; }
    a { color: var(--vscode-textLink-foreground); }
    .timer { color: var(--vscode-inputValidation-warningForeground); font-size: 12px; margin-top: 8px; }
  </style>
</head>
<body>
  <h1>🔒 Assistance Required</h1>
  <div class="meta">
    <div><strong>Task:</strong> ${this.escapeHtml(request.taskId)} — ${this.escapeHtml(request.taskDescription)}</div>
    <div><strong>Phase:</strong> ${this.escapeHtml(request.phase)}</div>
    <div><strong>Category:</strong> ${this.escapeHtml(request.category)}</div>
    <div class="timer">Auto-timeout in: <span id="timer">${timeoutSeconds}s</span></div>
  </div>

  <div class="section">
    <div class="section-title">Why I need help:</div>
    <div>${this.escapeHtml(request.message)}</div>
  </div>

  <div class="section">
    <div class="section-title">What I was trying to do:</div>
    <div>${this.escapeHtml(request.context.whatAIWasTrying)}</div>
  </div>

  <div class="section">
    <div class="section-title">What went wrong:</div>
    <div>${this.escapeHtml(request.context.whatWentWrong)}</div>
  </div>

  <div class="section">
    <div class="section-title">What I need from you:</div>
    <div>${this.escapeHtml(request.context.whatIsNeeded)}</div>
  </div>

  ${codeHtml}
  ${stackHtml}
  ${attemptedFixesHtml}
  ${suggestionsHtml}
  ${docsHtml}

  <div class="section">
    <div class="section-title">Your Response:</div>
    <textarea id="response" placeholder="Provide guidance or paste the requested information..."></textarea>
  </div>

  <div>
    <button onclick="resolve()">Resume AI Execution</button>
    <button onclick="dismiss()">Dismiss (Stop AI)</button>
    <button onclick="feedback('helpful')">👍 Helpful</button>
    <button onclick="feedback('unhelpful')">👎 Not Helpful</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let timeLeft = ${timeoutSeconds};
    const timerEl = document.getElementById('timer');
    const interval = setInterval(() => {
      timeLeft -= 1;
      if (timerEl) timerEl.textContent = timeLeft + 's';
      if (timeLeft <= 0) { clearInterval(interval); dismiss(); }
    }, 1000);

    function resolve() {
      const response = document.getElementById('response').value;
      vscode.postMessage({ type: 'HITL_RESOLVED', response, feedback: 'skipped' });
    }
    function dismiss() { clearInterval(interval); vscode.postMessage({ type: 'HITL_DISMISSED' }); }
    function feedback(val) { vscode.postMessage({ type: 'HITL_FEEDBACK', feedback: val }); }
  </script>
</body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public getPendingRequests(): HITLRequest[] {
    return this.requests.filter((r) => r.status === 'awaiting-response' || r.status === 'pending');
  }

  public getRequest(id: string): HITLRequest | undefined {
    return this.requests.find((r) => r.id === id);
  }

  public resolveRequest(id: string, response?: string): void {
    const request = this.requests.find((r) => r.id === id);
    if (request) {
      request.status = 'resolved';
      if (response) request.response = response;
    }
  }

  public dismissRequest(id: string): void {
    const request = this.requests.find((r) => r.id === id);
    if (request) request.status = 'dismissed';
  }

  public getResponse(id: string): string | undefined {
    const request = this.requests.find((r) => r.id === id);
    return request?.response;
  }

  public getAllRequests(): HITLRequest[] {
    return [...this.requests];
  }
}
