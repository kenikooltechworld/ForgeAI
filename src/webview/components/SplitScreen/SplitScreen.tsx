import { useState, useRef, useEffect, useCallback } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import ActivityStream from '../ActivityStream/ActivityStream';
import LivePreview from '../LivePreview/LivePreview';
import { useConversationStore } from '../../store/conversationStore';

/**
 * SplitScreen - Two-column layout with resizable divider
 *
 * Features:
 * - Activity Stream (left panel, 50% default)
 * - Live Preview (right panel, 50% default) - ALWAYS VISIBLE
 * - Draggable divider for resizing (30% to 70% range on wide screens, 40% to 60% on narrow)
 * - Both panels always visible - preview panel shows empty state when no content
 * - Persists width ratio to workspace state
 * - Throttled resize events for performance
 *
 * CRITICAL: The split-screen is ALWAYS visible. The preview panel should never be hidden.
 * This ensures users can see code diffs, test results, and file previews immediately.
 *
 * Requirements: 11.1-11.5, 36.1-36.5, 52.4
 */
function SplitScreen() {
  const [leftWidth, setLeftWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [prevLeftWidth, setPrevLeftWidth] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive behavior - but ALWAYS show split-screen
  // The preview panel should always be visible, even when empty
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Get preview state from store
  const previewType = useConversationStore((state) => state.previewType);
  const previewData = useConversationStore((state) => state.previewData);

  // Load saved width from workspace state
  useEffect(() => {
    window.vscode?.postMessage({ type: 'getSplitScreenWidth' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'splitScreenWidth' && typeof message.width === 'number') {
        setLeftWidth(message.width);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Persist width changes to workspace state
  const persistWidth = useCallback((width: number) => {
    window.vscode?.postMessage({
      type: 'setSplitScreenWidth',
      width,
    });
  }, []);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Adjust constraints based on screen width
      const isNarrowScreen = window.innerWidth < 1200;
      const minWidth = isNarrowScreen ? 40 : 30;
      const maxWidth = isNarrowScreen ? 60 : 70;

      // Constrain between min and max
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newLeftWidth));
      setLeftWidth(constrainedWidth);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // Persist width when dragging stops
      persistWidth(leftWidth);
    }
  }, [isDragging, leftWidth, persistWidth]);

  const toggleRightPanel = useCallback(() => {
    if (isRightCollapsed) {
      setIsRightCollapsed(false);
      setLeftWidth(prevLeftWidth);
    } else {
      setPrevLeftWidth(leftWidth);
      setIsRightCollapsed(true);
      setLeftWidth(100);
    }
  }, [isRightCollapsed, leftWidth, prevLeftWidth]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Throttled resize handler (max 10 events per second = 100ms)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (timeoutId) return; // Throttle: ignore if already scheduled

      timeoutId = setTimeout(() => {
        setWindowWidth(window.innerWidth);
        timeoutId = null;
      }, 100); // 100ms = 10 events per second
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Adjust minimum width for narrow screens, but ALWAYS show both panels
  const isNarrowScreen = windowWidth < 1200;
  const minLeftWidth = isNarrowScreen ? 40 : 30; // Allow more space for activity stream on narrow screens
  const maxLeftWidth = isNarrowScreen ? 60 : 70;

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* Activity Stream (Left Panel) */}
      <div className="h-full overflow-hidden" style={{ width: `${leftWidth}%` }}>
        <ActivityStream />
      </div>

      {/* Divider with collapse/expand toggle */}
      <div
        className="relative flex items-center justify-center transition"
        style={{
          width: '4px',
          backgroundColor: isDragging ? 'var(--vscode-focusBorder)' : 'var(--vscode-panel-border)',
          cursor: isRightCollapsed ? 'pointer' : 'col-resize',
        }}
        onMouseDown={isRightCollapsed ? undefined : handleMouseDown}
      >
        <button
          onClick={toggleRightPanel}
          title={isRightCollapsed ? 'Expand live preview' : 'Collapse live preview'}
          className="absolute flex items-center justify-center rounded-full border"
          style={{
            width: '20px',
            height: '20px',
            backgroundColor: 'var(--vscode-editor-background)',
            borderColor: 'var(--vscode-panel-border)',
            color: 'var(--vscode-foreground)',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          {isRightCollapsed ? <PanelRightOpen size={12} /> : <PanelRightClose size={12} />}
        </button>
      </div>

      {/* Live Preview (Right Panel) */}
      {!isRightCollapsed && (
        <div className="h-full overflow-hidden" style={{ width: `${100 - leftWidth}%` }}>
          <LivePreview type={previewType} data={previewData} />
        </div>
      )}
    </div>
  );
}

export default SplitScreen;
