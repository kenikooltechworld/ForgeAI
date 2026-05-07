import React, { useState } from 'react';
import { Cloud, Download } from 'lucide-react';
import { useConversationStore } from '../../store/conversationStore';
import TabContextMenu from './TabContextMenu';

function TabBar() {
  const tabs = useConversationStore((state) => state.tabs);
  const tabOrder = useConversationStore((state) => state.tabOrder);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const conversations = useConversationStore((state) => state.conversations);
  const createTab = useConversationStore((state) => state.createTab);
  const closeTab = useConversationStore((state) => state.closeTab);
  const switchTab = useConversationStore((state) => state.switchTab);
  const reorderTabs = useConversationStore((state) => state.reorderTabs);

  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(
    null
  );

  // Get active conversation to display model
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const currentModel = activeConversation?.model || 'gpt-oss:120b-cloud';

  // Get ordered tabs
  const orderedTabs = tabOrder
    .map((id) => tabs.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  const handleNewTab = () => {
    createTab();
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  const handleTabClick = (tabId: string) => {
    switchTab(tabId);
  };

  const handleMiddleClick = (e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) {
      // Middle mouse button
      e.preventDefault();
      closeTab(tabId);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  };

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  };

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedTabId && draggedTabId !== tabId) {
      setDragOverTabId(tabId);
    }
  };

  const handleDragLeave = () => {
    setDragOverTabId(null);
  };

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();

    if (!draggedTabId || draggedTabId === targetTabId) {
      setDraggedTabId(null);
      setDragOverTabId(null);
      return;
    }

    const draggedIndex = tabOrder.indexOf(draggedTabId);
    const targetIndex = tabOrder.indexOf(targetTabId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTabId(null);
      setDragOverTabId(null);
      return;
    }

    // Create new order
    const newOrder = [...tabOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedTabId);

    reorderTabs(newOrder);
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  // Truncate title if longer than 20 characters
  const truncateTitle = (title: string) => {
    return title.length > 20 ? `${title.substring(0, 20)}...` : title;
  };

  // Find active tab
  const activeTab = tabs.find((t) => t.conversationId === activeConversationId);

  // Display maximum 10 visible tabs
  const visibleTabs = orderedTabs.slice(0, 10);
  const hasMoreTabs = orderedTabs.length > 10;

  return (
    <div className="flex items-center bg-(--vscode-editorGroupHeader-tabsBackground) border-b border-(--vscode-editorGroupHeader-tabsBorder)">
      {/* Scrollable tabs container */}
      <div className="flex items-center gap-1 overflow-x-auto flex-1">
        {visibleTabs.map((tab) => {
          const isActive = tab.id === activeTab?.id;
          const isDragging = tab.id === draggedTabId;
          const isDragOver = tab.id === dragOverTabId;

          return (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={(e) => handleDragOver(e, tab.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, tab.id)}
              onDragEnd={handleDragEnd}
              onMouseDown={(e) => handleMiddleClick(e, tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onClick={() => handleTabClick(tab.id)}
              className={`
                group flex items-center gap-2 px-3 py-2 cursor-pointer min-w-32 max-w-48 transition-colors flex-shrink-0
                ${
                  isActive
                    ? 'bg-(--vscode-tab-activeBackground) text-(--vscode-tab-activeForeground) border-b-2 border-(--vscode-tab-activeBorder)'
                    : 'bg-(--vscode-tab-inactiveBackground) text-(--vscode-tab-inactiveForeground) hover:bg-(--vscode-tab-hoverBackground)'
                }
                ${isDragging ? 'opacity-50' : ''}
                ${isDragOver ? 'border-l-2 border-(--vscode-focusBorder)' : ''}
              `}
            >
              <span className="text-sm truncate flex-1" title={tab.title}>
                {truncateTitle(tab.title)}
              </span>
              <button
                onClick={(e) => handleCloseTab(e, tab.id)}
                className="hover:bg-(--vscode-toolbar-hoverBackground) rounded p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Close tab"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Overflow indicator */}
      {hasMoreTabs && (
        <div className="px-2 py-2 text-xs text-(--vscode-descriptionForeground) flex-shrink-0">
          +{orderedTabs.length - 10}
        </div>
      )}

      {/* New tab button */}
      <button
        onClick={handleNewTab}
        className="px-3 py-2 hover:bg-(--vscode-toolbar-hoverBackground) text-(--vscode-foreground) transition-colors flex-shrink-0"
        aria-label="New tab"
      >
        +
      </button>

      {/* Current Model Display */}
      {activeConversation && (
        <div className="px-3 py-2 text-xs text-(--vscode-descriptionForeground) flex-shrink-0 border-l border-(--vscode-editorGroupHeader-tabsBorder) flex items-center gap-1">
          {currentModel.includes('cloud') ? (
            <Cloud size={12} style={{ color: 'var(--vscode-descriptionForeground)' }} />
          ) : (
            <Download size={12} style={{ color: 'var(--vscode-descriptionForeground)' }} />
          )}
          {currentModel.split(':')[0]}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <TabContextMenu
          tabId={contextMenu.tabId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export default TabBar;
