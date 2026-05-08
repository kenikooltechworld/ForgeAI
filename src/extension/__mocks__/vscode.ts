/**
 * Mock implementation of VS Code API for testing
 */

export const window = {
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  })),
  visibleTextEditors: [],
};

export const workspace = {
  workspaceFolders: [],
  getConfiguration: jest.fn(() => ({
    get: jest.fn(),
    update: jest.fn(),
    has: jest.fn(),
    inspect: jest.fn(),
  })),
  findFiles: jest.fn(() => Promise.resolve([])),
  openTextDocument: jest.fn(),
  onDidChangeConfiguration: jest.fn(),
  onDidChangeTextDocument: jest.fn(),
  onDidSaveTextDocument: jest.fn(),
};

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn(),
};

export const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path, path })),
  parse: jest.fn((uri: string) => ({ fsPath: uri, path: uri })),
};

export const Range = jest.fn();
export const Position = jest.fn();
export const Selection = jest.fn();

export const languages = {
  registerCodeActionsProvider: jest.fn(),
  registerCompletionItemProvider: jest.fn(),
  registerHoverProvider: jest.fn(),
  getDiagnostics: jest.fn(() => []),
};

export const extensions = {
  getExtension: jest.fn(),
  all: [],
};

export const env = {
  clipboard: {
    writeText: jest.fn(),
    readText: jest.fn(),
  },
  openExternal: jest.fn(),
};

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
}

export const EventEmitter = jest.fn(() => ({
  event: jest.fn(),
  fire: jest.fn(),
  dispose: jest.fn(),
}));

export const CancellationTokenSource = jest.fn(() => ({
  token: {
    isCancellationRequested: false,
    onCancellationRequested: jest.fn(),
  },
  cancel: jest.fn(),
  dispose: jest.fn(),
}));
