# ErrorNotification Component

## Overview

The ErrorNotification component displays errors in the activity stream with appropriate styling, action buttons, and auto-dismiss functionality. It provides a polished error handling UI with contextual actions based on error type.

## Features

- **Error Type Classification**: Supports 6 error types with specific actions
- **Auto-Dismiss**: Automatically dismisses after 10 seconds (configurable)
- **Pin Functionality**: Users can pin notifications to prevent auto-dismiss
- **Visual Countdown**: Progress bar shows remaining time before auto-dismiss
- **Contextual Actions**: Different action buttons based on error type
- **VS Code Theme Integration**: Uses VS Code error validation colors
- **Accessibility**: Proper ARIA labels and semantic HTML

## Error Types

### 1. OLLAMA_CONNECTION

Cannot connect to Ollama service.

**Actions:**

- [Open Docs] - Opens Ollama documentation
- [Retry] - Retries the connection

### 2. OLLAMA_MODEL_NOT_FOUND

Requested model is not available.

**Actions:**

- [View Models] - Opens Ollama model documentation
- [Retry] - Retries after model is pulled

### 3. OLLAMA_TIMEOUT

Request timed out.

**Actions:**

- [Retry] - Retries the request
- [Skip] - Continues without the operation

### 4. TOOL_EXECUTION_ERROR

Tool failed to execute.

**Actions:**

- [Retry] - Retries the tool execution
- [Skip] - Skips the failed tool

### 5. NETWORK_ERROR

Network request failed.

**Actions:**

- [Retry] - Retries the request
- [Check Connection] - Opens troubleshooting docs

### 6. UNKNOWN

Generic error.

**Actions:**

- [Retry] - Retries the operation
- [Report Issue] - Opens GitHub issue template

## Usage

```tsx
import { ErrorNotification } from '../ErrorNotification';

<ErrorNotification
  errorType="OLLAMA_CONNECTION"
  title="Connection Error"
  message="Cannot connect to Ollama. Please ensure Ollama is running."
  onRetry={() => handleRetry()}
  onSkip={() => handleSkip()}
  onDismiss={() => handleDismiss()}
  autoDismiss={true}
  dismissTimeout={10000}
/>;
```

## Props

| Prop           | Type       | Required | Default | Description                        |
| -------------- | ---------- | -------- | ------- | ---------------------------------- |
| errorType      | ErrorType  | Yes      | -       | Type of error (determines actions) |
| title          | string     | Yes      | -       | Error title                        |
| message        | string     | Yes      | -       | Error message                      |
| onRetry        | () => void | No       | -       | Retry callback                     |
| onSkip         | () => void | No       | -       | Skip callback                      |
| onDismiss      | () => void | Yes      | -       | Dismiss callback                   |
| autoDismiss    | boolean    | No       | true    | Enable auto-dismiss                |
| dismissTimeout | number     | No       | 10000   | Auto-dismiss timeout (ms)          |

## Integration

### MessageList.tsx

The ErrorNotification is integrated into MessageList.tsx to display error messages:

```tsx
{
  message.role === 'error' && message.error && (
    <ErrorNotification
      errorType={(message.error.type as ErrorType) || 'UNKNOWN'}
      title={message.error.type || 'Error'}
      message={message.error.message}
      onRetry={() => handleErrorRetry(message)}
      onSkip={() => handleErrorSkip(message)}
      onDismiss={() => handleErrorDismiss(message.id)}
      autoDismiss={true}
      dismissTimeout={10000}
    />
  );
}
```

### WebviewManager.ts

Error logging is handled in WebviewManager.ts:

```typescript
private categorizeError(error: unknown): {
  type: string;
  message: string;
  actionButton?: { label: string; url: string };
} {
  // Log error to output channel for debugging
  this.logger.error('Error occurred during agent execution', error);

  // Categorize and return error details
  // ...
}
```

## Styling

The component uses VS Code CSS variables for theming:

- `--vscode-inputValidation-errorBorder` - Border color
- `--vscode-inputValidation-errorBackground` - Background color
- `--vscode-inputValidation-errorForeground` - Text color
- `--vscode-button-background` - Button background
- `--vscode-button-foreground` - Button text
- `--vscode-button-hoverBackground` - Button hover state

## Accessibility

- Uses semantic HTML with `role="alert"` and `aria-live="assertive"`
- Proper ARIA labels for interactive elements
- Keyboard accessible buttons
- Visual countdown indicator

## Auto-Dismiss Behavior

1. Timer starts when component mounts
2. Progress bar shows remaining time
3. User can pin to prevent auto-dismiss
4. Unpinning resumes countdown
5. Dismisses automatically when timer reaches 0

## Error Recovery Actions

### Retry

Re-executes the failed operation. Sends `retryAfterError` message to extension.

### Skip

Continues without the failed operation. Logs the skip action.

### Report Issue

Opens GitHub issue template with error details pre-filled.

## Task Implementation

This component implements:

- **Task 16.1**: Error notification system with auto-dismiss and pin functionality
- **Task 16.2**: Error recovery actions (Retry, Skip, Report Issue)
- **Task 16.2**: Error logging to extension output channel

## Future Enhancements

- [ ] Error history/log viewer
- [ ] Batch error handling
- [ ] Custom error templates
- [ ] Error analytics/tracking
- [ ] Offline error queue
