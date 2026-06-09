/**
 * File operation handlers: apply changes, open file, undo changes.
 */

import * as vscode from 'vscode';
import { Logger } from './Logger';

export class FileOperationHandler {
  constructor(
    private readonly view: vscode.WebviewView | undefined,
    private readonly logger: Logger
  ) {}

  async applyChanges(filePath: string, content: string): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      const isAbsolute = /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('/');
      const fileUri = isAbsolute
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);

      const buffer = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(fileUri, buffer);

      vscode.window.showInformationMessage(`Changes applied to ${filePath}`);

      this.view?.webview.postMessage({ type: 'applyChangesSuccess', filePath });
    } catch (error) {
      this.logger.error(`Failed to apply changes to ${filePath}`, error);
      vscode.window.showErrorMessage(
        `Failed to apply changes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.view?.webview.postMessage({
        type: 'applyChangesError',
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async openFile(filePath: string, lineNumber?: number): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      const isAbsolute = /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('/');
      const fileUri = isAbsolute
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);

      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });

      if (lineNumber !== undefined && lineNumber > 0) {
        const position = new vscode.Position(lineNumber - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }

    } catch (error) {
      this.logger.error(`Failed to open file ${filePath}`, error);
      vscode.window.showErrorMessage(
        `Failed to open file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async undoChanges(filePath: string, originalContent: string): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      const isAbsolute = /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('/');
      const fileUri = isAbsolute
        ? vscode.Uri.file(filePath)
        : vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);

      const buffer = Buffer.from(originalContent, 'utf8');
      await vscode.workspace.fs.writeFile(fileUri, buffer);

      vscode.window.showInformationMessage(`Changes undone for ${filePath}`);

      this.view?.webview.postMessage({ type: 'undoChangesSuccess', filePath });
    } catch (error) {
      this.logger.error(`Failed to undo changes for ${filePath}`, error);
      vscode.window.showErrorMessage(
        `Failed to undo changes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.view?.webview.postMessage({
        type: 'undoChangesError',
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
