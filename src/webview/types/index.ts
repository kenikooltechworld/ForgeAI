export interface WebviewMessage {
  type: string;
  [key: string]: unknown;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  model?: string; // Selected Ollama model for this conversation
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error' | 'tool';
  content: string;
  timestamp: number;
  thinking?: string; // AI reasoning process
  tokenUsage?: {
    thinkingTokens?: number;
    totalTokens?: number;
  };
  error?: {
    type: string;
    message: string;
    actionButton?: {
      label: string;
      url: string;
    };
  };
  toolExecution?: {
    toolName: string;
    target?: string;
    status: 'Pending' | 'Running' | 'Complete' | 'Error';
    duration?: number;
    error?: string;
    result?: any;
    arguments?: Record<string, any>;
  };
}

declare global {
  interface Window {
    vscode: {
      postMessage: (message: any) => void;
      getState?: () => unknown;
    };
  }
}
