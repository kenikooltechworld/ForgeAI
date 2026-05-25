import * as vscode from 'vscode';
import { OllamaClient, OllamaMessage, OllamaStreamChunk } from '../ollama/OllamaClient';
import { Logger } from '../utils/Logger';
import { DEFAULT_MODEL } from '../config/ModelConfig';

/**
 * Language Model Chat Provider for ForgeAI
 * Registers Ollama models into VS Code's native model picker
 * Requirement 2: Language Model Chat Provider Registration
 */
export class LanguageModelChatProvider implements vscode.LanguageModelChatProvider {
  private ollamaClient: OllamaClient;
  private logger: Logger;
  private toolRegistry: any; // ToolRegistry instance

  // Cache to avoid hammering Ollama /api/tags (prevents HITP 429)
  private modelsCache: vscode.LanguageModelChatInformation[] | null = null;
  private modelsCacheExpiryMs = 0;
  private modelsCacheTtlMs = 30_000; // 30s

  constructor(ollamaClient: OllamaClient, logger: Logger, toolRegistry?: any) {
    this.ollamaClient = ollamaClient;
    this.logger = logger;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Provide information about available language models
   * Requirement 2.2: Provide model information for qwen3-coder-397b
   */
  async provideLanguageModelChatInformation(
    options: { silent: boolean },
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelChatInformation[]> {
    this.logger.info('provideLanguageModelChatInformation called');

    if (options.silent) {
      this.logger.info('Silent mode - returning empty array');
      return [];
    }

    try {
      // Fetch available models from Ollama
      const models = await this.fetchOllamaModels();

      this.logger.info(`Found ${models.length} models from Ollama`);

      return models;
    } catch (error) {
      this.logger.error('Failed to fetch Ollama models', error);
      // Return default model even if Ollama is not available
      return this.getDefaultModels();
    }
  }

  /**
   * Handle chat requests and stream responses
   * Requirement 2.4: Stream response chunks via progress callback
   */
  async provideLanguageModelChatResponse(
    model: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: any,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken
  ): Promise<void> {
    this.logger.info(`provideLanguageModelChatResponse called for model: ${model.id}`);

    try {
      // Convert VS Code messages to Ollama format
      const ollamaMessages = this.convertMessages(messages);

      this.logger.info(`Sending ${ollamaMessages.length} messages to Ollama`);

      // Get tools from ToolRegistry instead of options
      const tools = this.toolRegistry ? this.toolRegistry.getToolDefinitions() : [];
      this.logger.info(`Using ${tools.length} tools from ToolRegistry`);

      // Stream response from Ollama
      const stream = (await this.ollamaClient.chat({
        model: model.id,
        messages: ollamaMessages,
        stream: true,
        think: true, // Enable thinking mode (Requirement 4.3)
        tools: tools, // Use tools from ToolRegistry
      })) as AsyncGenerator<OllamaStreamChunk>;

      // Forward chunks to VS Code
      for await (const chunk of stream) {
        if (token.isCancellationRequested) {
          this.logger.info('Request cancelled by user');
          break;
        }

        // Stream text content
        if (chunk.message?.content) {
          progress.report(new vscode.LanguageModelTextPart(chunk.message.content));
        }

        // Stream tool calls
        if (chunk.message?.tool_calls) {
          for (const toolCall of chunk.message.tool_calls) {
            progress.report(
              new vscode.LanguageModelToolCallPart(
                toolCall.id ?? '',
                toolCall.function.name,
                toolCall.function.arguments
              )
            );
          }
        }
      }

      this.logger.info('Response streaming completed');
    } catch (error) {
      this.logger.error('Error in provideLanguageModelChatResponse', error);
      throw error;
    }
  }

  /**
   * Provide token count estimation
   * Requirement 2.5: Return estimated token count
   */
  async provideTokenCount(
    model: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatRequestMessage,
    token: vscode.CancellationToken
  ): Promise<number> {
    // Simple estimation: ~4 characters per token
    const textContent = typeof text === 'string' ? text : this.extractTextContent(text);
    const tokenCount = Math.ceil(textContent.length / 4);

    this.logger.info(
      `Token count estimation: ${tokenCount} tokens for ${textContent.length} characters`
    );

    return tokenCount;
  }

  /**
   * Fetch available models from Ollama API
   */
  private async fetchOllamaModels(): Promise<vscode.LanguageModelChatInformation[]> {
    try {
      const response = await fetch('http://localhost:11434/api/tags');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const models: vscode.LanguageModelChatInformation[] = [];

      // Map Ollama models to VS Code format
      for (const model of data.models || []) {
        const modelInfo = this.mapOllamaModelToVSCode(model);
        if (modelInfo) {
          models.push(modelInfo);
        }
      }

      // Always include default model if not present
      if (!models.find((m) => m.id === DEFAULT_MODEL)) {
        models.unshift(this.getDefaultModels()[0]);
      }

      return models;
    } catch (error) {
      this.logger.error('Failed to fetch from Ollama API', error);
      throw error;
    }
  }

  /**
   * Map Ollama model to VS Code LanguageModelChatInformation format
   */
  private mapOllamaModelToVSCode(ollamaModel: any): vscode.LanguageModelChatInformation | null {
    const name = ollamaModel.name || ollamaModel.model;

    if (!name) return null;

    // Extract model family and version
    const [family, version] = name.split(':');

    // Determine capabilities based on model name
    const supportsTools = true; // Most modern models support tool calling
    const supportsVision = name.includes('vl') || name.includes('vision');

    return {
      id: name,
      name: this.formatModelName(name),
      family: family || 'unknown',
      version: version || '1.0.0',
      maxInputTokens: 128000, // Default context window
      maxOutputTokens: 8192, // Default max output
      capabilities: {
        toolCalling: supportsTools,
        imageInput: supportsVision,
      },
    };
  }

  /**
   * Get default models (fallback when Ollama is not available)
   * Requirement 2.2: Provide default model with correct specifications
   */
  private getDefaultModels(): vscode.LanguageModelChatInformation[] {
    const [family, version] = DEFAULT_MODEL.split(':');
    return [
      {
        id: DEFAULT_MODEL,
        name: this.formatModelName(DEFAULT_MODEL),
        family: family || 'unknown',
        version: version || 'latest',
        maxInputTokens: 128000, // Requirement 2.2
        maxOutputTokens: 8192, // Requirement 2.2
        tooltip: 'Main coding model with tool calling support',
        detail: 'Cloud-hosted via Ollama',
        capabilities: {
          toolCalling: true, // Requirement 2.3
          imageInput: false,
        },
      },
    ];
  }

  /**
   * Convert VS Code messages to Ollama format
   */
  private convertMessages(
    messages: readonly vscode.LanguageModelChatRequestMessage[]
  ): OllamaMessage[] {
    return messages.map((msg) => {
      const ollamaMsg: OllamaMessage = {
        role: msg.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant',
        content: this.extractTextContent(msg),
      };

      return ollamaMsg;
    });
  }

  /**
   * Extract text content from a message
   */
  private extractTextContent(msg: vscode.LanguageModelChatRequestMessage | string): string {
    if (typeof msg === 'string') {
      return msg;
    }

    // Extract text from message content parts
    const textParts = msg.content
      .filter((part) => part instanceof vscode.LanguageModelTextPart)
      .map((part) => part.value);

    return textParts.join('');
  }

  /**
   * Format model name for display
   */
  private formatModelName(name: string): string {
    // Convert "qwen3-coder:397b" to "Qwen3-Coder 397B"
    const [family, version] = name.split(':');
    const formattedFamily = family
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('-');

    if (version) {
      const formattedVersion = version.toUpperCase();
      return `${formattedFamily} ${formattedVersion}`;
    }

    return formattedFamily;
  }
}
