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
  images?: Array<{ name: string; dataUrl: string }>; // Attached images
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
  research?: {
    active: boolean;
    topics: { slug: string; status: string; query: string; findingsCount?: number; sourceTypes?: string[] }[];
    totalTopics: number;
    status: string;
    totalFindings?: number;
  };
}

export interface AgentActivityItem {
  id: string;
  type: 'start' | 'complete' | 'error';
  text: string;
  icon?: string;
  timestamp: number;
  metadata?: {
    fileName?: string;
    fileNames?: string[];
    count?: number;
    duration?: number;
    url?: string;
    query?: string;
  };
}

declare global {
  interface Window {
    vscode: {
      postMessage: (message: any) => void;
      getState?: () => unknown;
    };
    __FORGEAI_PANEL__?: 'rag';
  }
}
