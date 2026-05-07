import React, { useEffect, useRef, useState } from 'react';
import { useConversationStore } from '../../store/conversationStore';

interface TabContextMenuProps {
  tabId: string;
  x: number;
  y: number;
  onClose: () => void;
}

function TabContextMenu({ tabId, x, y, onClose }: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const tabs = useConversationStore((state) => state.tabs);
  const renameTab = useConversationStore((state) => state.renameTab);
  const duplicateTab = useConversationStore((state) => state.duplicateTab);
  const closeTab = useConversationStore((state) => state.closeTab);
  const closeOtherTabs = useConversationStore((state) => state.closeOtherTabs);
  const closeAllTabs = useConversationStore((state) => state.closeAllTabs);
  const exportConversation = useConversationStore((state) => state.exportConversation);

  const tab = tabs.find((t) => t.id === tabId);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleRename = () => {
    if (tab) {
      setNewTitle(tab.title);
      setIsRenaming(true);
    }
  };

  const handleRenameSubmit = () => {
    if (newTitle.trim()) {
      renameTab(tabId, newTitle.trim());
    }
    setIsRenaming(false);
    onClose();
  };

  const handleDuplicate = () => {
    duplicateTab(tabId);
    onClose();
  };

  const handleClose = () => {
    closeTab(tabId);
    onClose();
  };

  const handleCloseOthers = () => {
    closeOtherTabs(tabId);
    onClose();
  };

  const handleCloseAll = () => {
    closeAllTabs();
    onClose();
  };

  const handleExport = () => {
    exportConversation(tabId);
    onClose();
  };

  if (isRenaming) {
    return (
      <div
        ref={menuRef}
        className="fixed bg-(--vscode-menu-background) border border-(--vscode-menu-border) shadow-lg rounded z-50 p-2"
        style={{ left: x, top: y }}
      >
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleRenameSubmit();
            } else if (e.key === 'Escape') {
              setIsRenaming(false);
              onClose();
            }
          }}
          onBlur={handleRenameSubmit}
          autoFocus
          className="w-48 px-2 py-1 bg-(--vscode-input-background) text-(--vscode-input-foreground) border border-(--vscode-input-border) rounded"
        />
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed bg-(--vscode-menu-background) border border-(--vscode-menu-border) shadow-lg rounded z-50 min-w-48"
      style={{ left: x, top: y }}
    >
      <button
        onClick={handleRename}
        className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground) text-sm"
      >
        Rename
      </button>
      <button
        onClick={handleDuplicate}
        className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground) text-sm"
      >
        Duplicate
      </button>
      <div className="border-t border-(--vscode-menu-separatorBackground) my-1" />
      <button
        onClick={handleClose}
        className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground) text-sm"
      >
        Close
      </button>
      <button
        onClick={handleCloseOthers}
        className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground) text-sm"
      >
        Close Others
      </button>
      <button
        onClick={handleCloseAll}
        className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground) text-sm"
      >
        Close All
      </button>
      <div className="border-t border-(--vscode-menu-separatorBackground) my-1" />
      <button
        onClick={handleExport}
        className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground) text-sm"
      >
        Export Conversation
      </button>
    </div>
  );
}

export default TabContextMenu;
