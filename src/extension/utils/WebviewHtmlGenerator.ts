/**
 * HTML generation for the ForgeAI webview.
 */

import * as vscode from 'vscode';
import { Logger } from './Logger';

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getHtmlForWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  logger: Logger
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.js')
  );

  const styleResetUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'resources', 'reset.css')
  );

  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'style.css')
  );

  const logoUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'resources', 'kenikoolLogo.png')
  );

  const nonce = getNonce();

  logger.info(`Script URI: ${scriptUri.toString()}`);
  logger.info(`Style Reset URI: ${styleResetUri.toString()}`);
  logger.info(`Style URI: ${styleUri.toString()}`);
  logger.info(`CSP nonce: ${nonce}`);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};" />
    <title>ForgeAI</title>
    <style nonce="${nonce}">
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(0.92); }
      }
    </style>
    <link rel="stylesheet" href="${styleResetUri}" />
    <link rel="stylesheet" href="${styleUri}" />
  </head>
  <body>
    <div id="root">
      <div id="forgeai-loading" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;font-family:var(--vscode-font-family);background:var(--vscode-editor-background);">
        <img src="${logoUri}" alt="Kenikool Logo" style="width:64px;height:64px;object-fit:contain;border-radius:50px;animation:pulse 1.5s ease-in-out infinite;" />
        <span style="color:var(--vscode-descriptionForeground);font-size:13px;">Loading ForgeAI...</span>
      </div>
    </div>
    <script nonce="${nonce}">
      console.log('[ForgeAI] Webview initializing...');
      window.__FORGEAI_LOGO_URI__ = '${logoUri}';
      const vscodeApi = acquireVsCodeApi();
      window.vscode = vscodeApi;
      console.log('[ForgeAI] VS Code API acquired');
      window.addEventListener('error', function(e) {
        console.error('[ForgeAI] Global error:', e.message, e.filename, e.lineno);
        const root = document.getElementById('root');
        if (root) {
          root.innerHTML = '<div style="padding:20px;color:var(--vscode-errorForeground);font-family:var(--vscode-font-family);"><h3>ForgeAI Error</h3><pre>' + e.message + '<br/>' + (e.filename || '') + ':' + (e.lineno || '') + '</pre></div>';
        }
      });
      window.addEventListener('unhandledrejection', function(e) {
        console.error('[ForgeAI] Unhandled rejection:', e.reason);
        const root = document.getElementById('root');
        if (root) {
          root.innerHTML = '<div style="padding:20px;color:var(--vscode-errorForeground);font-family:var(--vscode-font-family);"><h3>ForgeAI Error</h3><pre>Unhandled Promise Rejection:<br/>' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)) + '</pre></div>';
        }
      });
    </script>
    <script type="module" nonce="${nonce}" src="${scriptUri}" onerror="document.getElementById('root').innerHTML='<div style=\'padding:20px;color:var(--vscode-errorForeground);\'>Failed to load ForgeAI script.</div>'"></script>
  </body>
</html>`;
}
