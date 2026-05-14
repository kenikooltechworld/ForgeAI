import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Star,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Database,
  Clock,
  FileText,
} from 'lucide-react';
import './RagSettings.css';

interface SourceStatus {
  sourceId: string;
  label: string;
  category: string;
  lastScrapedAtMs: number | null;
  pageCount: number | null;
  isScraping: boolean;
  error: string | null;
  selected: boolean;
  favorite: boolean;
}

type ScrapeProgressEvent =
  | { type: 'start'; sourceId: string }
  | { type: 'discover'; sourceId: string; discoveredCount: number }
  | { type: 'page'; sourceId: string; pageIndex: number; totalPages: number; url: string }
  | { type: 'complete'; sourceId: string; pages: number; upserted: number }
  | { type: 'error'; sourceId: string; error: string };

export default function RagSettings() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<Record<string, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request sources on mount
  useEffect(() => {
    window.vscode?.postMessage({ type: 'ragGetSources' });
  }, []);

  // Listen for messages from extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'ragSources':
          setSources(msg.statuses || []);
          setIsLoading(false);
          // Auto-expand categories that have selected or favorite sources
          const toExpand = new Set<string>();
          (msg.statuses || []).forEach((s: SourceStatus) => {
            if (s.selected || s.favorite) toExpand.add(s.category);
          });
          setExpandedCategories(toExpand);
          break;

        case 'ragSelectionChanged':
          setSources((prev) =>
            prev.map((s) => (s.sourceId === msg.sourceId ? { ...s, selected: msg.selected } : s))
          );
          setHasChanges(true);
          break;

        case 'ragFavoriteChanged':
          setSources((prev) =>
            prev.map((s) => (s.sourceId === msg.sourceId ? { ...s, favorite: msg.favorite } : s))
          );
          break;

        case 'ragScrapeStarted':
          setIsScraping(true);
          setError(null);
          setScrapeProgress({});
          setSources((prev) => prev.map((s) => ({ ...s, isScraping: s.selected, error: null })));
          break;

        case 'ragScrapeProgress': {
          const event: ScrapeProgressEvent = msg.event;
          const progressText = ((): string => {
            switch (event.type) {
              case 'start':
                return 'Starting...';
              case 'discover':
                return `Discovered ${event.discoveredCount} pages...`;
              case 'page':
                return `Scraping page ${event.pageIndex}/${event.totalPages}...`;
              case 'complete':
                return `Complete — ${event.pages} pages, ${event.upserted} upserted`;
              case 'error':
                return `Error: ${event.error}`;
            }
          })();
          setScrapeProgress((prev) => ({ ...prev, [event.sourceId]: progressText }));

          if (event.type === 'complete' || event.type === 'error') {
            setSources((prev) =>
              prev.map((s) =>
                s.sourceId === event.sourceId
                  ? {
                      ...s,
                      isScraping: false,
                      lastScrapedAtMs: event.type === 'complete' ? Date.now() : s.lastScrapedAtMs,
                      pageCount: event.type === 'complete' ? event.pages : s.pageCount,
                      error: event.type === 'error' ? event.error : null,
                    }
                  : s
              )
            );
          }
          break;
        }

        case 'ragScrapeComplete':
          setIsScraping(false);
          setHasChanges(false);
          break;

        case 'ragScrapeCancelled':
          setIsScraping(false);
          setScrapeProgress({});
          setSources((prev) => prev.map((s) => ({ ...s, isScraping: false })));
          break;

        case 'ragScrapeError':
          setIsScraping(false);
          setError(msg.error);
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const selectedCount = useMemo(() => sources.filter((s) => s.selected).length, [sources]);

  const favoriteCount = useMemo(() => sources.filter((s) => s.favorite).length, [sources]);

  const categories = useMemo(() => {
    const map = new Map<string, SourceStatus[]>();
    for (const s of sources) {
      const arr = map.get(s.category) || [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return map;
  }, [sources]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const toggleSource = useCallback((sourceId: string) => {
    window.vscode?.postMessage({ type: 'ragToggleSelected', sourceId });
  }, []);

  const toggleFavorite = useCallback((sourceId: string) => {
    window.vscode?.postMessage({ type: 'ragToggleFavorite', sourceId });
  }, []);

  const startScrape = useCallback(() => {
    const selectedIds = sources.filter((s) => s.selected).map((s) => s.sourceId);
    if (selectedIds.length === 0) {
      setError('Please select at least one documentation source.');
      return;
    }
    setError(null);
    window.vscode?.postMessage({ type: 'ragStartScrape', sourceIds: selectedIds });
  }, [sources]);

  const cancelScrape = useCallback(() => {
    window.vscode?.postMessage({ type: 'ragCancelScrape' });
  }, []);

  const formatDate = (ms: number | null): string => {
    if (!ms) return 'Never';
    const date = new Date(ms);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="rag-settings-loading">
        <Loader2 className="rag-spinner" size={24} />
        <span>Loading documentation sources...</span>
      </div>
    );
  }

  return (
    <div className="rag-settings">
      {/* Header */}
      <div className="rag-header">
        <div className="rag-header-title">
          <Database size={18} />
          <h2>RAG Documentation Sources</h2>
        </div>
        <p className="rag-header-subtitle">
          Select which documentation sources ForgeAI should index for chat context.
        </p>
      </div>

      {/* Stats bar */}
      <div className="rag-stats">
        <div className="rag-stat">
          <Check size={14} />
          <span>{selectedCount} selected</span>
        </div>
        <div className="rag-stat">
          <Star size={14} />
          <span>{favoriteCount} favorites</span>
        </div>
        <div className="rag-stat">
          <FileText size={14} />
          <span>{sources.reduce((sum, s) => sum + (s.pageCount ?? 0), 0)} total pages indexed</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rag-error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Source list grouped by category */}
      <div className="rag-source-list scrollable-modern">
        {Array.from(categories.entries()).map(([category, items]) => {
          const isExpanded = expandedCategories.has(category);
          const selectedInCategory = items.filter((s) => s.selected).length;

          return (
            <div key={category} className="rag-category">
              <button
                className="rag-category-header"
                onClick={() => toggleCategory(category)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="rag-category-name">{category}</span>
                <span className="rag-category-count">
                  {selectedInCategory}/{items.length}
                </span>
              </button>

              {isExpanded && (
                <div className="rag-category-items">
                  {items.map((source) => (
                    <div
                      key={source.sourceId}
                      className={`rag-source-item ${source.isScraping ? 'rag-source-scraping' : ''} ${source.error ? 'rag-source-error' : ''}`}
                    >
                      <label className="rag-source-checkbox-label">
                        <input
                          type="checkbox"
                          checked={source.selected}
                          onChange={() => toggleSource(source.sourceId)}
                          disabled={isScraping}
                        />
                        <span className="rag-source-name">{source.label}</span>
                      </label>

                      <div className="rag-source-actions">
                        {/* Favorite toggle */}
                        <button
                          className={`rag-favorite-btn ${source.favorite ? 'rag-favorite-active' : ''}`}
                          onClick={() => toggleFavorite(source.sourceId)}
                          disabled={isScraping}
                          aria-label={source.favorite ? 'Remove favorite' : 'Add favorite'}
                          title={source.favorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star size={14} fill={source.favorite ? 'currentColor' : 'none'} />
                        </button>

                        {/* Status info */}
                        <div className="rag-source-meta">
                          {source.pageCount !== null && source.pageCount > 0 && (
                            <span className="rag-meta-chip" title="Indexed pages">
                              <FileText size={12} />
                              {source.pageCount}
                            </span>
                          )}
                          {source.lastScrapedAtMs && (
                            <span className="rag-meta-chip" title="Last scraped">
                              <Clock size={12} />
                              {formatDate(source.lastScrapedAtMs)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress / status for this source */}
                      {source.isScraping && scrapeProgress[source.sourceId] && (
                        <div className="rag-source-progress">
                          <Loader2 size={12} className="rag-spinner" />
                          <span>{scrapeProgress[source.sourceId]}</span>
                        </div>
                      )}
                      {source.error && !source.isScraping && (
                        <div className="rag-source-error-text">
                          <AlertCircle size={12} />
                          <span>{source.error}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer action bar */}
      <div className="rag-footer">
        {isScraping ? (
          <button className="rag-btn rag-btn-secondary" onClick={cancelScrape}>
            <X size={16} />
            Cancel Scraping
          </button>
        ) : (
          <button
            className={`rag-btn rag-btn-primary ${selectedCount === 0 ? 'rag-btn-disabled' : ''}`}
            onClick={startScrape}
            disabled={selectedCount === 0}
          >
            <RefreshCw size={16} />
            {hasChanges ? 'Save & Scrape Selected' : 'Scrape Selected'}
          </button>
        )}

        {isScraping && (
          <div className="rag-scraping-indicator">
            <Loader2 size={14} className="rag-spinner" />
            <span>Scraping in progress... This may take a few minutes.</span>
          </div>
        )}
      </div>
    </div>
  );
}
