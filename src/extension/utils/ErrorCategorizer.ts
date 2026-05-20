/**
 * Error categorization utilities for ForgeAI.
 * Pure functions — no class state, easy to test.
 */

import { Logger } from './Logger';

export interface CategorizedError {
  type: string;
  message: string;
  actionButton?: { label: string; url: string };
}

export interface OllamaFetchErrorDetails {
  code: string;
  title: string;
  message: string;
  steps: string[];
}

/**
 * Categorize general agent execution errors
 */
export function categorizeError(error: unknown, logger: Logger): CategorizedError {
  logger.error('Error occurred during agent execution', error);

  if (error instanceof Error) {
    if (
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('fetch failed') ||
      error.message.includes('Cannot connect to Ollama')
    ) {
      logger.error('OLLAMA_CONNECTION error: Cannot connect to Ollama service');
      return {
        type: 'OLLAMA_CONNECTION',
        message:
          'Cannot connect to Ollama. Please ensure Ollama is running on http://localhost:11434',
        actionButton: {
          label: 'Open Ollama Docs',
          url: 'https://docs.ollama.com',
        },
      };
    }

    if (error.message.includes('404') || error.message.includes('Model not found')) {
      logger.error('OLLAMA_MODEL_NOT_FOUND error: Model not available');
      return {
        type: 'OLLAMA_MODEL_NOT_FOUND',
        message: 'Model not found. Please pull the model using: ollama pull [model-name]',
        actionButton: {
          label: 'Open Ollama Docs',
          url: 'https://docs.ollama.com',
        },
      };
    }

    if (
      error.message.includes('timeout') ||
      error.message.includes('timed out') ||
      error.name === 'AbortError'
    ) {
      logger.error('OLLAMA_TIMEOUT error: Request timed out');
      return {
        type: 'OLLAMA_TIMEOUT',
        message: 'Ollama request timed out. The model may be loading. Please try again.',
        actionButton: {
          label: 'Open Ollama Docs',
          url: 'https://docs.ollama.com',
        },
      };
    }

    logger.error(`UNKNOWN error: ${error.message}`);
    return {
      type: 'UNKNOWN',
      message: error.message || 'An unknown error occurred',
    };
  }

  logger.error('UNKNOWN error: Non-Error object thrown');
  return {
    type: 'UNKNOWN',
    message: 'An unknown error occurred',
  };
}

/**
 * Categorize Ollama /api/tags fetch errors
 */
export function categorizeOllamaFetchError(error: unknown): OllamaFetchErrorDetails {
  if (!(error instanceof Error)) {
    return {
      code: 'UNKNOWN_ERROR',
      title: 'Unknown Error',
      message: 'An unexpected error occurred while connecting to Ollama.',
      steps: [
        'Check if Ollama is running',
        'Run: ollama serve',
        'Visit: https://docs.ollama.com for help',
      ],
    };
  }

  if (error.message.includes('HTTP_403')) {
    return {
      code: 'PERMISSION_DENIED',
      title: 'Permission Denied',
      message:
        'Ollama is running but refusing the connection. This usually means Ollama is configured to only accept connections from specific sources.',
      steps: [
        'Check if Ollama is running with restricted access',
        'Restart Ollama without access restrictions',
        'Run: ollama serve',
        'If the issue persists, check your firewall settings',
      ],
    };
  }

  if (error.message.includes('HTTP_404')) {
    return {
      code: 'API_NOT_FOUND',
      title: 'Ollama API Not Found',
      message:
        'The Ollama API endpoint was not found. This might mean you are running an older version of Ollama.',
      steps: [
        'Update Ollama to the latest version',
        'Visit: https://ollama.com/download',
        'Download and install the latest version',
        'Restart Ollama after updating',
      ],
    };
  }

  if (error.message.includes('HTTP_500') || error.message.includes('HTTP_502')) {
    return {
      code: 'SERVER_ERROR',
      title: 'Ollama Server Error',
      message: 'Ollama is running but encountered an internal error. This is usually temporary.',
      steps: [
        'Wait a few seconds and try again',
        'If the error persists, restart Ollama',
        'Run: ollama serve',
        'Check Ollama logs for more details',
      ],
    };
  }

  if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
    return {
      code: 'CONNECTION_REFUSED',
      title: 'Ollama Not Running',
      message: 'Cannot connect to Ollama. It appears Ollama is not running on your system.',
      steps: [
        'Open a terminal or command prompt',
        'Run: ollama serve',
        'Wait for "Ollama is running" message',
        'Return to ForgeAI and try again',
        '',
        'Need help? Visit: https://docs.ollama.com',
      ],
    };
  }

  if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
    return {
      code: 'CONNECTION_TIMEOUT',
      title: 'Connection Timeout',
      message: 'The connection to Ollama timed out. Ollama might be starting up or overloaded.',
      steps: [
        'Wait 10-15 seconds for Ollama to fully start',
        'Try again',
        'If the issue persists, restart Ollama',
        'Run: ollama serve',
      ],
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    title: 'Connection Error',
    message: `An unexpected error occurred: ${error.message}`,
    steps: [
      'Check if Ollama is installed',
      'Run: ollama --version',
      'If not installed, visit: https://ollama.com/download',
      'After installation, run: ollama serve',
    ],
  };
}
