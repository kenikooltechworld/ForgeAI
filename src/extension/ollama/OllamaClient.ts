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
  private readonly timeout: number = 30000; // 30 seconds

  constructor(baseUrl: string = 'http://localhost:11434', logger: Logger) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.logger = logger;
    this.logger.info(`OllamaClient initialized with baseUrl: ${this.baseUrl}`);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Send a chat request to Ollama with streaming support and retry logic
   * @param request Chat request options
   * @returns AsyncGenerator for streaming or Promise for non-streaming
   */
  public async chat(
    request: OllamaChatRequest
  ): Promise<OllamaChatResponse | AsyncGenerator<OllamaStreamChunk>> {
    this.logger.info(
      `Sending chat request to Ollama: model=${request.model}, stream=${request.stream}, think=${request.think}`
    );

    // Retry with exponential backoff (1s, 2s, 4s) up to 3 attempts
    return this.retryWithBackoff(async () => {
      try {
        if (request.stream) {
          return this.streamChat(request);
        } else {
          return this.nonStreamChat(request);
        }
      } catch (error) {
        this.handleError(error);
        throw error; // TypeScript requires this after handleError
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
          this.logger.error(`Max retries (${maxRetries}) exceeded`);
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const backoff = initialDelay * Math.pow(2, attempt);
        this.logger.info(`Retry attempt ${attempt + 1}/${maxRetries} after ${backoff}ms`);
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OllamaChatResponse = await response.json();
      this.logger.info(`Received non-streaming response from Ollama: done=${data.done}`);

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Streaming chat request
   */
  private async *streamChat(request: OllamaChatRequest): AsyncGenerator<OllamaStreamChunk> {
    const url = `${this.baseUrl}/api/chat`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      this.logger.info('Started streaming response from Ollama');

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.logger.info('Streaming completed');
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '') continue;

          try {
            const chunk: OllamaStreamChunk = JSON.parse(line);
            yield chunk;

            if (chunk.done) {
              this.logger.info('Received done signal from Ollama');
              return;
            }
          } catch (parseError) {
            this.logger.warn(`Failed to parse streaming chunk: ${line}`, parseError);
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * List available models from Ollama
   * @returns List of available models
   */
  public async listModels(): Promise<OllamaModel[]> {
    this.logger.info('Fetching available models from Ollama');

    const url = `${this.baseUrl}/api/tags`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OllamaListResponse = await response.json();
      this.logger.info(`Retrieved ${data.models.length} models from Ollama`);

      return data.models;
    } catch (error) {
      clearTimeout(timeoutId);
      this.handleError(error);
      throw error; // TypeScript requires this after handleError
    }
  }

  /**
   * Check if Ollama is running and accessible
   * @returns true if Ollama is accessible, false otherwise
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      this.logger.warn('Ollama is not available', error);
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
        this.logger.error(message, error);
        throw new OllamaConnectionError(message, this.baseUrl, error);
      }

      // Timeout
      if (error.name === 'AbortError') {
        const message = `Request to Ollama timed out after ${this.timeout}ms`;
        this.logger.error(message, error);
        throw new OllamaConnectionError(message, this.baseUrl, error);
      }

      // HTTP errors
      if (error.message.includes('HTTP')) {
        const message = `Ollama API error: ${error.message}`;
        this.logger.error(message, error);
        throw new OllamaConnectionError(message, this.baseUrl, error);
      }

      // Generic error
      this.logger.error('Ollama request failed', error);
      throw new OllamaConnectionError(error.message, this.baseUrl, error);
    }

    // Unknown error type
    const message = 'Unknown error occurred while communicating with Ollama';
    this.logger.error(message, error);
    throw new OllamaConnectionError(message, this.baseUrl);
  }
}
