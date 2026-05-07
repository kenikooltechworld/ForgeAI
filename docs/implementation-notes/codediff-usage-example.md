# CodeDiff Component - Usage Example

## Basic Usage

```tsx
import CodeDiff from './components/LivePreview/CodeDiff';

// Example diff data
const exampleDiff = {
  file: 'src/auth/login.ts',
  lines: [
    { type: 'unchanged', lineNumber: 43, content: 'export async function login() {' },
    { type: 'unchanged', lineNumber: 44, content: '  const user = await getUser();' },
    { type: 'removed', lineNumber: 45, content: '  const token = req.token;' },
    { type: 'added', lineNumber: 46, content: '  const token = req.token || null;' },
    { type: 'unchanged', lineNumber: 47, content: '  return { user, token };' },
    { type: 'unchanged', lineNumber: 48, content: '}' },
  ],
  language: 'typescript',
  originalContent: `export async function login() {
  const user = await getUser();
  const token = req.token;
  return { user, token };
}`,
};

// Render CodeDiff
function MyComponent() {
  return (
    <CodeDiff
      diff={exampleDiff}
      onApply={() => console.log('Changes applied')}
      onReject={() => console.log('Changes rejected')}
      onOpenInEditor={() => console.log('File opened in editor')}
    />
  );
}
```

## Integration with LivePreview

```tsx
import { LivePreview } from './components/LivePreview/LivePreview';

function App() {
  const [diffData, setDiffData] = useState(null);

  // When AI generates a code change
  const handleCodeChange = (diff) => {
    setDiffData({
      file: diff.filePath,
      lines: diff.lines,
      language: diff.language,
      originalContent: diff.originalContent,
    });
  };

  return (
    <LivePreview
      type="diff"
      data={{
        ...diffData,
        onApply: () => {
          console.log('Changes applied');
          // Optionally close diff view
          setDiffData(null);
        },
        onReject: () => {
          console.log('Changes rejected');
          // Close diff view
          setDiffData(null);
        },
        onOpenInEditor: () => {
          console.log('File opened in editor');
        },
      }}
    />
  );
}
```

## Message Flow

### Apply Changes Flow

```
1. User clicks "Apply Changes" button
   ↓
2. CodeDiff stores originalContent in state
   ↓
3. CodeDiff generates new content from diff lines
   ↓
4. CodeDiff sends message to extension:
   {
     type: 'applyChanges',
     filePath: 'src/auth/login.ts',
     content: '...' // new content
   }
   ↓
5. Extension writes file using vscode.workspace.fs.writeFile
   ↓
6. Extension shows success notification
   ↓
7. Extension sends response to webview:
   {
     type: 'applyChangesSuccess',
     filePath: 'src/auth/login.ts'
   }
   ↓
8. CodeDiff updates UI to show Undo button
```

### Undo Changes Flow

```
1. User clicks "Undo" button
   ↓
2. CodeDiff sends message to extension:
   {
     type: 'undoChanges',
     filePath: 'src/auth/login.ts',
     originalContent: '...' // original content
   }
   ↓
3. Extension writes original content using vscode.workspace.fs.writeFile
   ↓
4. Extension shows "Changes undone" notification
   ↓
5. Extension sends response to webview:
   {
     type: 'undoChangesSuccess',
     filePath: 'src/auth/login.ts'
   }
   ↓
6. CodeDiff resets state and shows Apply button again
```

### Open in Editor Flow

```
1. User clicks "Open in Editor" button
   ↓
2. CodeDiff finds first changed line number
   ↓
3. CodeDiff sends message to extension:
   {
     type: 'openFile',
     filePath: 'src/auth/login.ts',
     lineNumber: 45
   }
   ↓
4. Extension opens file using vscode.window.showTextDocument
   ↓
5. Extension jumps to line 45
```

## Error Handling

```tsx
// Extension sends error response
{
  type: 'applyChangesError',
  filePath: 'src/auth/login.ts',
  error: 'Permission denied'
}

// CodeDiff handles error
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    const message = event.data;

    if (message.type === 'applyChangesError') {
      console.error('Failed to apply changes:', message.error);
      // Reset state
      setIsApplied(false);
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

## Testing

### Manual Test Script

```typescript
// 1. Create test diff data
const testDiff = {
  file: 'test.txt',
  lines: [
    { type: 'unchanged', lineNumber: 1, content: 'Line 1' },
    { type: 'removed', lineNumber: 2, content: 'Old line 2' },
    { type: 'added', lineNumber: 3, content: 'New line 2' },
    { type: 'unchanged', lineNumber: 4, content: 'Line 3' },
  ],
  originalContent: 'Line 1\nOld line 2\nLine 3',
};

// 2. Render CodeDiff
<CodeDiff diff={testDiff} />

// 3. Test Apply
// - Click "Apply Changes"
// - Verify file updated
// - Verify success notification
// - Verify "Undo" button appears

// 4. Test Undo
// - Click "Undo"
// - Verify file restored
// - Verify "Changes undone" notification
// - Verify "Apply Changes" button appears

// 5. Test Open in Editor
// - Click "Open in Editor"
// - Verify file opens in VS Code
// - Verify cursor at line 2 (first changed line)

// 6. Test Reject
// - Click "Reject"
// - Verify diff view closes
// - Verify no file changes
```

## Best Practices

1. **Always provide originalContent** - Required for undo functionality
2. **Include context lines** - Show 3 lines before/after changes for clarity
3. **Use proper line numbers** - Match actual file line numbers
4. **Handle errors gracefully** - Listen for error messages from extension
5. **Clean up state** - Reset state on reject/undo
6. **Provide callbacks** - Use onApply/onReject/onOpenInEditor for custom behavior

## Common Issues

### Issue: Undo button doesn't appear

**Solution:** Ensure `originalContent` is provided in diff data

### Issue: File not found error

**Solution:** Ensure file path is relative to workspace root

### Issue: Permission denied error

**Solution:** Check file permissions, ensure file is not read-only

### Issue: Changes not applied

**Solution:** Check browser console for errors, verify VS Code API is available
