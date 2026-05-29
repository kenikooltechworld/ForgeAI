import { Logger } from '../utils/Logger';
import { OllamaConnectionError } from '../errors/ExtensionErrors';

/**
 * Ollama message format
 */
export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  thinking?: string;
  tool_calls?: OllamaToolCall[];
  name?: string; // Tool name for role='tool' messages (Ollama API convention)
  images?: string[]; // Base64 encoded images for vision models
}

/**
 * Ollama tool call format
 */
export interface OllamaToolCall {
  id?: string;
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

/**
 * Ollama chat request options
 */
export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  think?: boolean;
  tools?: OllamaTool[];
  options?: {
    temperature?: number;
    num_ctx?: number;
    [key: string]: any;
  };
}

/**
 * Ollama tool definition
 */
export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      required?: string[];
      properties: Record<string, any>;
    };
  };
}

/**
 * Ollama chat response (non-streaming)
 */
export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Ollama streaming chunk
 */
export interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: Partial<OllamaMessage>;
  done: boolean;
  prompt_eval_count?: number; // Token count for prompt evaluation
  eval_count?: number; // Token count for response generation
}

/**
 * Ollama model information
 */
export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

/**
 * Ollama list models response
 */
export interface OllamaListResponse {
  models: OllamaModel[];
}

/**
 * Production-ready Ollama HTTP Client for ForgeAI
 * Implements chat() with streaming support and listModels()
 * Follows 2026 Ollama API patterns with thinking mode and tool calling
 */
export class OllamaClient {
  private readonly baseUrl: string;
  private readonly logger: Logger;

  constructor(baseUrl: string = 'http://localhost:11434', logger: Logger) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.logger = logger;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Estimate token count for text (rough approximation: ~4 chars per token)
   * This is a conservative estimate for most models
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get context window size for a model — actual values from official sources.
   * These are used both for context management (4-tier triage) and for
   * setting num_ctx in Ollama requests so the model uses its full window.
   */
  private getContextWindowSize(model: string): number {
    // Exact context windows from official Ollama model configurations
    // Source: https://docs.ollama.com/context-length and Ollama model library
    const contextWindows: Record<string, number> = {
      // ── Cloud models ──────────────────────────────────────────────────────
      'gpt-oss-120b-cloud': 131_072, // 131K — OpenAI GPT-OSS 120B
      'gemma4-31b-cloud': 256_000, // 256K — Google Gemma 4 31B
      'qwen3.5-397b-cloud': 128_000, // 128K — Qwen 3.5 397B
      'deepseek-v3.1-671b-cloud': 128_000, // 128K — DeepSeek V3.1
      'kimi-k2.5-cloud': 256_000, // 256K — Kimi K2.5

      // ── Local Ollama models ──────────────────────────────────────────────────────
      // Llama 3.x - 8K base, 128K for Llama 3.1/3.2+
      'llama3': 8_192, 'llama3-8b': 8_192, 'llama3-70b': 8_192,
      'llama3.1': 128_000, 'llama3.1-8b': 128_000, 'llama3.1-70b': 128_000, 'llama3.1-405b': 128_000,
      'llama3.2': 128_000, 'llama3.2-1b': 128_000, 'llama3.2-3b': 128_000,
      'llama3.2-vision': 128_000, 'llama3.2-vision-11b': 128_000, 'llama3.2-vision-90b': 128_000,

      // Gemma 3/4 - 128K/256K context (per official Ollama)
      'gemma': 8_192, 'gemma-2b': 8_192, 'gemma-7b': 8_192,
      'gemma3': 128_000, 'gemma3-270m': 32_768, 'gemma3-1b': 32_768, 'gemma3-4b': 128_000, 'gemma3-12b': 128_000, 'gemma3-27b': 128_000,
      // Gemma4: E2B/E4B=128K, 26B/31B=256K
      'gemma4': 256_000, 'gemma4-e2b': 128_000, 'gemma4-e4b': 128_000, 'gemma4-26b': 256_000, 'gemma4-31b': 256_000,

      // Qwen 2.5/3 - up to 128K context
      'qwen2.5': 128_000, 'qwen2.5-0.5b': 128_000, 'qwen2.5-1.5b': 128_000, 'qwen2.5-3b': 128_000,
      'qwen2.5-7b': 128_000, 'qwen2.5-14b': 128_000, 'qwen2.5-32b': 128_000, 'qwen2.5-72b': 128_000,
      'qwen3': 128_000, 'qwen3-0.6b': 128_000, 'qwen3-4b': 128_000, 'qwen3-8b': 128_000, 'qwen3-14b': 128_000, 'qwen3-32b': 128_000,
      'qwen3.5': 128_000, 'qwen3.5-9b': 128_000, 'qwen3.5-27b': 128_000, 'qwen3.5-35b': 128_000,

      // DeepSeek - 128K context
      'deepseek-r1': 128_000, 'deepseek-r1-1.5b': 128_000, 'deepseek-r1-7b': 128_000, 'deepseek-r1-8b': 128_000,
      'deepseek-r1-14b': 128_000, 'deepseek-r1-32b': 128_000, 'deepseek-r1-70b': 128_000, 'deepseek-r1-671b': 128_000,
      'deepseek-v3.1': 128_000, 'deepseek-v3.1-128b': 128_000,

      // Llava (vision) - Ollama official: 7b=32K, 13b/34b=4K
      'llava': 32_768, 'llava-7b': 32_768, 'llava-13b': 4_096, 'llava-34b': 4_096,
      'bakllava': 32_768, 'moondream': 8_192,

      // Phi 4 - 128K context
      'phi4': 128_000, 'phi4-14b': 128_000, 'phi4-mini': 128_000,

      // Mistral/Nemo - 128K context
      'mistral-nemo': 128_000, 'mistral-nemo-12b': 128_000,
      'mistral-small': 128_000, 'mistral-small-22b': 128_000, 'mistral-small-24b': 128_000,

      // Qwen3-Coder - native 256K context (confirmed on ollama.com)
      'qwen3-coder': 256_000, 'qwen3-coder-30b': 256_000, 'qwen3-coder-480b': 256_000,

      // Coding models - Qwen2.5-Coder: 0.5b/1.5b/3b=32K, 7b/14b/32b=128K
      'qwen2.5-coder': 128_000, 'qwen2.5-coder-0.5b': 32_768, 'qwen2.5-coder-1.5b': 32_768, 'qwen2.5-coder-3b': 32_768,
      'qwen2.5-coder-7b': 128_000, 'qwen2.5-coder-14b': 128_000, 'qwen2.5-coder-32b': 128_000,
      'starcoder2': 16_000, 'starcoder2-7b': 16_000, 'starcoder2-15b': 16_000,
    };

    // Exact match
    if (contextWindows[model]) {
      return contextWindows[model];
    }

    // Normalize: replace colons with dashes for matching (e.g. "gemma4:31b-cloud" → "gemma4-31b-cloud")
    const lower = model.toLowerCase().replace(/:/g, '-');
    for (const [key, value] of Object.entries(contextWindows)) {
      if (key.toLowerCase() === lower) {
        return value;
      }
    }

    // Partial match — e.g. "gemma4-31b" matches "gemma4-31b-cloud"
    for (const [key, value] of Object.entries(contextWindows)) {
      const normKey = key.toLowerCase().replace(/:/g, '-');
      if (lower.includes(normKey) || normKey.includes(lower)) {
        return value;
      }
    }

    // No assumptions - require explicit model configuration
    throw new Error(
      `Unknown model '${model}' - no context window size configured. ` +
        `Please add the model to the contextWindows mapping in OllamaClient.ts. ` +
        `Known models: ${Object.keys(contextWindows).join(', ')}`
    );
  }

  /**
   * Context management using the industry-standard 4-tier triage approach.
   *
   * Tier 1 — System prompt:        ALWAYS kept, never touched.
   * Tier 2 — User/assistant turns: Kept as-is; only dropped as a last resort.
   * Tier 3 — Recent tool results:  Kept (last 5 tool results to preserve context).
   * Tier 4 — Old tool results:     FIRST target — replace with compact metadata tag.
   *
   * This matches how Claude Code / Windsurf handle context:
   *   - Tool outputs are the biggest token consumers and the cheapest to lose.
   *   - Conversation turns carry intent and must be preserved.
   *   - No separate summarization LLM call needed (we don't have a cheap side-model).
   *
   * CRITICAL FIX: Keep more recent tool results (5 instead of 3) to prevent
   * breaking the agent loop after tool calls. The model needs context of what
   * just happened to continue reasoning.
   */
  private applySlidingWindow(
    messages: OllamaMessage[],
    model: string,
    maxTokensForResponse: number = 2000
  ): OllamaMessage[] {
    const contextWindow = this.getContextWindowSize(model);
    // INCREASED: 90% → 95% to preserve more context
    // INCREASED: response buffer 2000 → 3000 tokens for longer responses
    const safeLimit = Math.floor(contextWindow * 0.95); // 95% threshold (less aggressive)
    const effectiveLimit = safeLimit - maxTokensForResponse;

    // ── Fast path: already within budget ──────────────────────────────────────
    let totalTokens = messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);
    if (totalTokens <= effectiveLimit) {
      return messages;
    }

    // ── Tier 4: truncate OLD tool-result messages first ───────────────────────
    // Keep the 10 most-recent tool results intact; replace older ones with a tag.
    // INCREASED: 5 → 10 to preserve more tool context
    const MAX_TOOL_RESULT_CHARS = 1000; // INCREASED: 500 → 1000 chars to keep more detail

    // Count total tool messages so we can identify "old" ones
    const totalToolMsgs = messages.filter((m) => m.role === 'tool').length;
    let toolIdx = 0;
    const pass1 = messages.map((msg) => {
      if (msg.role !== 'tool') return msg;
      toolIdx++;
      const isOld = toolIdx <= totalToolMsgs - 10; // keep last 10 intact (was 5)
      if (!isOld) return msg;

      const preview = msg.content.slice(0, MAX_TOOL_RESULT_CHARS);
      const saved = msg.content.length - preview.length;
      if (saved <= 0) return msg;

      return {
        ...msg,
        content: `${preview}\n… [${saved} chars truncated — tool result compacted]`,
      };
    });

    totalTokens = pass1.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);

    if (totalTokens <= effectiveLimit) {
      return pass1;
    }

    // ── Tier 3: drop old tool-result messages entirely ────────────────────────
    // If still over budget, remove old tool results completely.
    // But keep the last 10 to preserve recent context.
    toolIdx = 0;
    const pass2 = pass1.filter((msg) => {
      if (msg.role !== 'tool') return true;
      toolIdx++;
      return toolIdx > totalToolMsgs - 10; // keep only last 10 (was 5)
    });

    totalTokens = pass2.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);

    if (totalTokens <= effectiveLimit) {
      return pass2;
    }

    // ── Tier 2: drop oldest conversation turns (keep system + recent N turns) ─
    // Only reach here if tool-result removal wasn't enough.

    const systemMsg = pass2[0]?.role === 'system' ? pass2[0] : null;
    const rest = systemMsg ? pass2.slice(1) : pass2;

    // CRITICAL: Always keep the last user message AND the last assistant message
    // (which may contain tool calls). Without these, the model has no context.
    const lastUserIdx =
      [...rest]
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.role === 'user')
        .pop()?.i ?? -1;

    const lastAssistantIdx =
      [...rest]
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.role === 'assistant')
        .pop()?.i ?? -1;

    // Walk from newest to oldest, accumulate until budget is full.
    // Always include the last user and assistant messages regardless of budget.
    const kept: OllamaMessage[] = [];
    let budget = effectiveLimit - (systemMsg ? this.estimateTokens(systemMsg.content) : 0);

    for (let i = rest.length - 1; i >= 0; i--) {
      const tokens = this.estimateTokens(rest[i].content);
      const isLastUserMsg = i === lastUserIdx;
      const isLastAssistantMsg = i === lastAssistantIdx;
      const isCritical = isLastUserMsg || isLastAssistantMsg;

      if (budget - tokens < 0 && !isCritical) {
        continue;
      }
      kept.unshift(rest[i]);
      budget -= tokens;
    }

    const result = systemMsg ? [systemMsg, ...kept] : kept;
    return result;
  }

  /**
   * Send a chat request to Ollama with streaming support and retry logic
   * @param request Chat request options
   * @returns AsyncGenerator for streaming or Promise for non-streaming
   */
  public async chat(
    request: OllamaChatRequest
  ): Promise<OllamaChatResponse | AsyncGenerator<OllamaStreamChunk>> {
    // Validate messages before processing
    if (!request.messages || request.messages.length === 0) {
      throw new Error('No messages provided to chat request');
    }

    // Apply sliding window to prevent context overflow
    request.messages = this.applySlidingWindow(request.messages, request.model);

    // Tell Ollama to use the model's full context window.
    const contextWindow = this.getContextWindowSize(request.model);
    request.options = {
      ...request.options,
      num_ctx: contextWindow,
    };

    // Validate messages after sliding window
    if (request.messages.length === 0) {
      throw new Error('Messages list is empty after sliding window - context management failed');
    }

    // Sanitize messages: Ollama rejects empty content strings.
    // - Assistant messages with tool_calls but no text get a single space placeholder.
    // - Tool messages with empty content get a placeholder.
    // - Filter out any message that has no content AND no tool_calls (completely empty).
    request.messages = request.messages
      .map((msg) => {
        if (!msg.content || msg.content.trim() === '') {
          if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
            // Tool-call-only assistant message — Ollama needs non-empty content
            return { ...msg, content: ' ' };
          }
          if (msg.role === 'tool') {
            // Empty tool result — replace with a placeholder
            return { ...msg, content: '[no output]' };
          }
        }
        return msg;
      })
      .filter((msg) => {
        // Drop completely empty messages that have no tool_calls either
        const hasContent = msg.content && msg.content.trim().length > 0;
        const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
        return hasContent || hasToolCalls;
      });

    // Final safety check: ensure we still have messages after sanitization
    if (request.messages.length === 0) {
      throw new Error(
        'All messages were filtered out during sanitization - this indicates a critical issue with message handling'
      );
    }

    // CRITICAL: Pre-flight check to prevent 500 errors from Ollama
    // Calculate total tokens and throw BEFORE sending if over limit
    const totalTokens = request.messages.reduce(
      (sum, m) => sum + this.estimateTokens(m.content),
      0
    );
    const safeLimit = Math.floor(contextWindow * 0.95) - 3000; // 95% - 3000 token buffer for response

    // Warn user when approaching context limit (75% threshold)
    if (totalTokens > safeLimit * 0.75) {
      this.logger.warn(
        `Context warning: ${totalTokens} tokens used, limit is ${safeLimit}. ` +
          `Consider a model with larger context or smaller steps.`
      );
    }

    if (totalTokens > safeLimit) {
      // Context is still too large even after sliding window
      // This should rarely happen, but if it does, throw a clear error
      throw new Error(
        `Context overflow: ${totalTokens} tokens exceeds safe limit of ${safeLimit} tokens. ` +
          `This indicates the sliding window failed to compress enough. ` +
          `Consider breaking this task into smaller subtasks or using a model with larger context window.`
      );
    }

    // Retry with exponential backoff (1s, 2s, 4s) up to 3 attempts
    return this.retryWithBackoff(async () => {
      if (request.stream) {
        return this.streamChat(request);
      } else {
        return this.nonStreamChat(request);
      }
    });
  }

  /**
   * Retry function with exponential backoff
   * @param fn Function to retry
   * @param maxRetries Maximum number of retries (default: 3)
   * @param initialDelay Initial delay in milliseconds (default: 1000)
   * @returns Result of the function
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        // Don't retry on 404 (model not found)
        if (error instanceof OllamaConnectionError && error.message.includes('Model not found')) {
          throw error;
        }

        if (attempt === maxRetries - 1) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const backoff = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Non-streaming chat request
   */
  private async nonStreamChat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    const url = `${this.baseUrl}/api/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          thinking: msg.thinking,
          tool_calls: msg.tool_calls,
          name: msg.name,
          images: msg.images, // Include images for vision models
        })),
        stream: false,
        think: request.think ?? false,
        tools: request.tools,
        options: request.options,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: OllamaChatResponse = await response.json();

    return data;
  }

  /**
   * Streaming chat request
   */
  private async *streamChat(request: OllamaChatRequest): AsyncGenerator<OllamaStreamChunk> {
    const url = `${this.baseUrl}/api/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          thinking: msg.thinking,
          tool_calls: msg.tool_calls,
          name: msg.name,
          images: msg.images, // Include images for vision models
        })),
        stream: true,
        think: request.think ?? false,
        tools: request.tools,
        options: request.options,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;

        try {
          const chunk: OllamaStreamChunk = JSON.parse(line);
          yield chunk;

          if (chunk.done) {
            return;
          }
        } catch (parseError) {
          // Skip unparseable chunks
        }
      }
    }
  }

  /**
   * List available models from Ollama
   * @returns List of available models
   */
  public async listModels(): Promise<OllamaModel[]> {
    const url = `${this.baseUrl}/api/tags`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OllamaListResponse = await response.json();
      return data.models;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Check if Ollama is running and accessible
   * @returns true if Ollama is accessible, false otherwise
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle errors and throw appropriate custom errors
   */
  private handleError(error: unknown): never {
    if (error instanceof Error) {
      // Connection refused (Ollama not running)
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        const message = 'Cannot connect to Ollama. Please ensure Ollama is running on port 11434.';
        throw new OllamaConnectionError(message, this.baseUrl, error);
      }

      // Abort (user cancelled or connection dropped)
      if (error.name === 'AbortError') {
        const message = 'Request to Ollama was aborted';
        throw new OllamaConnectionError(message, this.baseUrl, error);
      }

      // HTTP errors
      if (error.message.includes('HTTP')) {
        const message = `Ollama API error: ${error.message}`;
        throw new OllamaConnectionError(message, this.baseUrl, error);
      }

      // Generic error
      throw new OllamaConnectionError(error.message, this.baseUrl, error);
    }

    // Unknown error type
    const message = 'Unknown error occurred while communicating with Ollama';
    throw new OllamaConnectionError(message, this.baseUrl);
  }
}
