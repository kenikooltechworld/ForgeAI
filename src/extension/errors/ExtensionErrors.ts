import * as vscode from 'vscode';

/**
 * Base error class for ForgeAI extension
 */
export class ExtensionError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}

/**
 * Error thrown when file read operation fails
 */
export class FileReadError extends ExtensionError {
  constructor(
    message: string,
    public readonly uri: vscode.Uri,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'FileReadError';
  }
}

/**
 * Error thrown when file write operation fails
 */
export class FileWriteError extends ExtensionError {
  constructor(
    message: string,
    public readonly uri: vscode.Uri,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'FileWriteError';
  }
}

/**
 * Error thrown when Ollama connection fails
 */
export class OllamaConnectionError extends ExtensionError {
  constructor(
    message: string,
    public readonly baseUrl: string,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'OllamaConnectionError';
  }
}

/**
 * Error thrown when tool execution fails
 */
export class ToolExecutionError extends ExtensionError {
  constructor(
    message: string,
    public readonly toolName: string,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'ToolExecutionError';
  }
}
