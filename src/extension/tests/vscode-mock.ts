const vscode = {
  window: {
    createOutputChannel: () => ({
      appendLine: () => {},
      dispose: () => {},
    }),
  },
  workspace: {
    getConfiguration: (section: string) => ({
      get: (_key: string, fallback: unknown) => fallback,
      update: async () => {},
    }),
    workspaceFolders: [{ uri: { fsPath: 'C:\\Users\\KENIKOOL TECH WORLD\\Desktop\\ForgeAI' } }],
    onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
  },
  env: {
    openExternal: async () => {},
    asExternalUri: (uri: unknown) => uri,
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
    parse: (uri: string) => new URL(uri),
    joinPath: (...parts: unknown[]) => ({ fsPath: (parts as string[]).join('\\') }),
  },
  EventEmitter: class {
    event = (_e: unknown) => {};
    fire = (_e: unknown) => {};
    dispose = () => {};
  },
  lm: {
    registerTool: () => ({ dispose: () => {} }),
    selectChatModels: () => [],
    registerChatModelSelector: () => ({ dispose: () => {} }),
  },
  Disposable: class {
    constructor(public _disposable: { dispose: () => void }) {}
    dispose() {
      this._disposable.dispose();
    }
  },
  tasks: {
    Task: class {},
    TaskGroup: class {},
    TaskPanel: class {},
    TaskPresentationStyle: {},
    QuickPick: class {},
  },
  scm: {
    SourceControl: class {},
    SourceControlInputBox: class {},
  },
  extensions: {
    all: [],
    getExtension: () => null,
    getExtension: (id: string) => null,
    onDidChange: () => ({ dispose: () => {} }),
  },
  debug: {
    onDidStartDebugSession: () => ({ dispose: () => {} }),
    onDidTerminateDebugSession: () => ({ dispose: () => {} }),
    startDebugging: async () => false,
    stopDebugging: () => {},
  },
};

export const EventEmitter = vscode.EventEmitter;
export const Uri = vscode.Uri;
export default vscode;
