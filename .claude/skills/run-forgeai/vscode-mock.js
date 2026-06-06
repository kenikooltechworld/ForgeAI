module.exports = {
  workspace: {
    workspaceFolders: [
      {
        uri: {
          fsPath: process.cwd(),
        },
      },
    ],
  },
  Uri: {
    file: (path) => ({ fsPath: path, path: path }),
    joinPath: (...args) => ({ fsPath: args.join('/') }),
  },
  RelativePattern: class {
    constructor(pattern) {
      this.pattern = pattern;
    }
  },
  window: {
    createWebviewPanel: () => ({
      webview: {
        html: '',
        postMessage: () => {},
        onDidReceiveMessage: () => ({ dispose: () => {} }),
      },
      reveal: () => {},
      dispose: () => {},
    }),
  },
  CancellationToken: {
    none: {},
  },
  LanguageModelToolInvocationPrepareOptions: {},
  LanguageModelToolInvocationOptions: {},
  LanguageModelToolResult: class {
    constructor(parts) {
      this.parts = parts;
    }
  },
  LanguageModelTextPart: class {
    constructor(text) {
      this.text = text;
    }
  },
  lm: {
    registerTool: () => ({ dispose: () => {} }),
  },
};
