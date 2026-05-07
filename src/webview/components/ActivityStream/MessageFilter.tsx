import { useState, useEffect, useCallback } from 'react';

export type MessageFilterType = 'all' | 'user' | 'assistant' | 'tool' | 'thinking';

import { Search } from 'lucide-react';

interface MessageFilterProps {
  onFilterChange: (filter: MessageFilterType) => void;
  onSearchChange: (search: string) => void;
  resultCount?: number;
}

function MessageFilter({ onFilterChange, onSearchChange, resultCount }: MessageFilterProps) {
  const [selectedFilter, setSelectedFilter] = useState<MessageFilterType>('all');
  const [searchValue, setSearchValue] = useState('');

  // Debounce search input with 300ms delay (Requirement 52.2)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSearchChange(searchValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchValue, onSearchChange]);

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newFilter = e.target.value as MessageFilterType;
      setSelectedFilter(newFilter);
      onFilterChange(newFilter);
    },
    [onFilterChange]
  );

  const handleSearchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    onSearchChange('');
  }, [onSearchChange]);

  return (
    <div className="flex flex-col gap-2 border-b border-(--vscode-editorGroupHeader-tabsBorder) bg-(--vscode-editor-background) p-3">
      {/* Filter dropdown and search input row */}
      <div className="flex gap-2">
        {/* Filter dropdown */}
        <select
          value={selectedFilter}
          onChange={handleFilterChange}
          className="rounded border border-(--vscode-input-border) bg-(--vscode-input-background) px-2 py-1 text-sm text-(--vscode-input-foreground) focus:outline-none"
          style={{ minWidth: '120px' }}
        >
          <option value="all">All Messages</option>
          <option value="user">User</option>
          <option value="assistant">Assistant</option>
          <option value="tool">Tool</option>
          <option value="thinking">Thinking</option>
        </select>

        {/* Search input box with icon */}
        <div className="relative flex-1">
          <div
            className="absolute left-2 top-1/2 text-sm text-(--vscode-descriptionForeground)"
            style={{ transform: 'translateY(-50%)' }}
          >
            <Search size={14} style={{ color: 'var(--vscode-descriptionForeground)' }} />
          </div>
          <input
            type="text"
            value={searchValue}
            onChange={handleSearchInput}
            placeholder="Search messages..."
            className="w-full rounded border border-(--vscode-input-border) bg-(--vscode-input-background) py-1 pl-8 pr-8 text-sm text-(--vscode-input-foreground) placeholder:text-(--vscode-input-placeholderForeground) focus:outline-none"
          />
          {searchValue && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 text-sm text-(--vscode-descriptionForeground) hover:text-(--vscode-editor-foreground)"
              style={{ transform: 'translateY(-50%)' }}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {searchValue && resultCount !== undefined && (
        <div className="text-xs text-(--vscode-descriptionForeground)">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </div>
      )}
    </div>
  );
}

export default MessageFilter;
