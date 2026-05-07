# SplitScreen Component

**Status:** ✅ Task 4.4 Complete  
**Requirements:** 11.1-11.5, 36.1-36.5, 52.4

## Overview

The SplitScreen component provides a two-column layout with a resizable divider, containing the Activity Stream (left) and Live Preview (right) panels. It adapts responsively to window size and persists user preferences.

## Features

### Current (Task 4.4)

- ✅ Two-column layout (50/50 default split)
- ✅ Draggable divider for resizing
- ✅ Constrained resize range (30% to 70%)
- ✅ Responsive behavior (collapses to single column < 1200px)
- ✅ Persists width ratio to workspace state
- ✅ Throttled resize events (10 events/second max)
- ✅ VS Code theme integration
- ✅ Accessibility support (ARIA labels)

## Usage

```tsx
import SplitScreen from './components/SplitScreen';

// In App.tsx
function App() {
  const showWelcome = conversations.length === 0;

  return showWelcome ? <WelcomeScreen /> : <SplitScreen />;
}
```

## Layout Structure

```
┌─────────────────────────────────────────────────────┐
│                   SplitScreen                       │
│                                                     │
│  ┌──────────────────┬─┬──────────────────────────┐ │
│  │                  │ │                          │ │
│  │  ActivityStream  │▓│      LivePreview         │ │
│  │   (Left Panel)   │▓│     (Right Panel)        │ │
│  │                  │ │                          │ │
│  │   50% default    │▓│      50% default         │ │
│  │   30-70% range   │▓│      30-70% range        │ │
│  │                  │ │                          │ │
│  └──────────────────┴─┴──────────────────────────┘ │
│                      ▲                              │
│                 Draggable Divider                   │
└─────────────────────────────────────────────────────┘
```

## Responsive Behavior

### Desktop (≥ 1200px)

- Shows both panels side-by-side
- Divider is visible and draggable
- Default: 50% / 50% split
- User can resize: 30% / 70% to 70% / 30%

### Mobile/Narrow (< 1200px)

- Shows only Activity Stream (full width)
- Live Preview is hidden
- Divider is hidden
- Optimized for narrow screens

## Styling

**IMPORTANT:** This component follows VS Code extension styling best practices:

- ✅ Uses CSS classes from `globals.css` (e.g., `className="flex h-full"`)
- ✅ Inline styles ONLY for dynamic values (panel widths, divider color on hover)
- ❌ Does NOT use inline styles for static theme colors

This follows Requirements 8, 41-42 and Design Document Section 7.

## State Management

### Local State

- `leftWidth`: Percentage width of left panel (30-70)
- `isDragging`: Boolean indicating if divider is being dragged
- `windowWidth`: Current window width for responsive behavior

### Persisted State

- Width ratio saved to workspace state: `forgeai.splitScreenWidth`
- Loaded on mount
- Saved when dragging stops

## Resize Behavior

### Drag to Resize

1. User clicks divider (mousedown)
2. `isDragging` set to true
3. Mouse move events update `leftWidth`
4. Width constrained to 30-70% range
5. User releases mouse (mouseup)
6. `isDragging` set to false
7. Width persisted to workspace state

### Constraints

- Minimum left width: 30%
- Maximum left width: 70%
- Minimum right width: 30% (100 - 70)
- Maximum right width: 70% (100 - 30)

## Performance Optimizations

### Throttled Resize Events

- Window resize events throttled to 100ms (10 events/second)
- Prevents excessive re-renders during window resizing
- Meets Requirement 52.4

### Memoized Callbacks

- `handleMouseMove` memoized with `useCallback`
- `handleMouseUp` memoized with `useCallback`
- `persistWidth` memoized with `useCallback`
- Prevents unnecessary re-renders

### Event Cleanup

- Mouse event listeners removed when dragging stops
- Window resize listener removed on unmount
- Timeout cleared on unmount

## Accessibility

- Divider has `role="separator"` for screen readers
- Divider has `aria-label="Resize panels"` for context
- Keyboard navigation support (future enhancement)

## VS Code Theme Integration

The component uses VS Code CSS variables:

- Divider default: `var(--vscode-panel-border)`
- Divider hover: `var(--vscode-focusBorder)`
- Smooth transition on hover

## Message Protocol

### Get Split Screen Width

```typescript
// Webview → Extension
window.vscode.postMessage({ type: 'getSplitScreenWidth' });

// Extension → Webview
{ type: 'splitScreenWidth', width: 50 }
```

### Set Split Screen Width

```typescript
// Webview → Extension
window.vscode.postMessage({
  type: 'setSplitScreenWidth',
  width: 60,
});
```

## Extension Integration

The WebviewManager handles split screen width persistence:

```typescript
// In WebviewManager.ts
case 'getSplitScreenWidth': {
  const width = this.storageManager.getWorkspaceValue('forgeai.splitScreenWidth', 50);
  this.view?.webview.postMessage({ type: 'splitScreenWidth', width });
  break;
}

case 'setSplitScreenWidth': {
  await this.storageManager.setWorkspaceValue('forgeai.splitScreenWidth', message.width);
  break;
}
```

## Testing

### Visual Testing

1. Open Extension Development Host
2. Open ForgeAI sidebar
3. Create a conversation (to show SplitScreen)
4. Verify split-screen layout appears
5. Verify Activity Stream on left, LivePreview on right
6. Verify divider is visible between panels

### Resize Testing

1. Hover over divider → verify color changes
2. Click and drag divider left → verify panels resize
3. Click and drag divider right → verify panels resize
4. Try to drag beyond 30% → verify constraint works
5. Try to drag beyond 70% → verify constraint works
6. Release mouse → verify width persists

### Responsive Testing

1. Resize window to < 1200px width
2. Verify LivePreview disappears
3. Verify Activity Stream takes full width
4. Verify divider disappears
5. Resize window to ≥ 1200px width
6. Verify split-screen returns
7. Verify saved width ratio is restored

### Persistence Testing

1. Resize panels to 60/40 split
2. Close and reopen ForgeAI
3. Verify 60/40 split is restored
4. Resize to 40/60 split
5. Reload VS Code
6. Verify 40/60 split is restored

## Requirements Mapping

- **Requirement 11.1:** Two-column layout with Activity Stream and Live Preview ✅
- **Requirement 11.2:** Activity Stream occupies 50% width by default ✅
- **Requirement 11.3:** Live Preview occupies 50% width by default ✅
- **Requirement 11.4:** Supports resizing via draggable divider ✅
- **Requirement 11.5:** Collapses Live Preview when width < 1200px ✅
- **Requirement 36.1:** Two-column layout at 50/50 default ✅
- **Requirement 36.2:** Draggable divider allows 30-70% range ✅
- **Requirement 36.3:** Collapses to single column < 1200px ✅
- **Requirement 36.5:** Persists width ratio to workspace state ✅
- **Requirement 52.4:** Throttles resize events to 10/second ✅

## Design Reference

See `.kiro/specs/core-extension-foundation-phase-1/design.md` Section "SplitScreen Component" for complete design specification.

## Related Components

- **ActivityStream** - Left panel showing conversation and AI actions
- **LivePreview** - Right panel showing code changes and previews
- **App** - Parent component that renders SplitScreen or WelcomeScreen

## Future Enhancements

### Requirement 36.4 (Future)

- When window width > 1600px, support multiple views in LivePreview
- Show code diff + test results simultaneously
- Tabbed interface within LivePreview

### Keyboard Support (Future)

- Arrow keys to resize panels
- Escape to reset to 50/50
- Keyboard shortcuts for common layouts

### Layout Presets (Future)

- 50/50 (default)
- 60/40 (focus on activity)
- 40/60 (focus on preview)
- 70/30 (maximum activity)
- 30/70 (maximum preview)
