export const vscode = {
  window: {
    createOutputChannel: (name) => ({
      show: () => {},
      appendLine: (line) => console.log(`[OutputChannel ${name}] ${line}`),
      clear: () => {},
    }),
    showInformationMessage: async (msg, ...args) => {
      console.log(`[VSCode Window] ${msg}`, ...args);
      return null;
    },
    showErrorMessage: async (msg, ...args) => {
      console.error(`[VSCode Error] ${msg}`, ...args);
      return null;
    },
    showWarningMessage: async (msg, ...args) => {
      console.warn(`[VSCode Warning] ${msg}`, ...args);
      return null;
    },
    showInputBox: async (options) => {
      console.log(`[VSCode InputBox] ${options.prompt}`);
      return options.value || '';
    },
    showQuickPick: async (options, config) => {
      console.log(`[VSCode QuickPick] ${options[0]}`);
      return options[0];
    },
    showOpenDialog: async (options) => {
      console.log(`[VSCode OpenDialog] ${options.title}`);
      return [ { fsPath: options.defaultUri?.fsPath || '/mock/path' } ];
    },
    onDidChangeActiveColorTheme: () => ({ dispose: () => {} }),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: process.cwd() } }],
    fs: {
      createDirectory: async (uri) => {
        console.log(`[VSCode FS] createDirectory: ${uri}`);
        return null;
      },
      readDirectory: async (uri) => [],
      readFile: async (uri) => Buffer.from('mock file content'),
      writeFile: async (uri, content) => {},
      stat: async (uri) => ({ type: 1 }),
    },
    getConfiguration: () => ({
      get: (key, defaultValue) => defaultValue,
    }),
  },
  Uri: {
    file: (path) => ({ scheme: 'file', fsPath: path }),
    joinPath: (...parts) => {
      const path = parts.reduce((acc, p) => {
        if (p && typeof p === 'object' && p.fsPath) return acc + '/' + p.fsPath;
        return acc + '/' + (p || '');
      }, '');
      return { fsPath: path };
    },
  },
  commands: {
    executeCommand: async (cmd, ...args) => {
      console.log(`[VSCode Command] executing: ${cmd}`, ...args);
      return null;
    },
  },
  lm: {
    registerLanguageModelChatProvider: () => ({ dispose: () => {} }),
  },
  chat: {
    createChatParticipant: (id, handler) => ({
      iconPath: { fsPath: '' },
      followupProvider: {},
      dispose: () => {},
    }),
  },
};

export default vscode;
