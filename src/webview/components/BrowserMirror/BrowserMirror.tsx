import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RefreshCw,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Maximize,
  ChevronDown,
  ChevronUp,
  Terminal,
  Network,
  AlertTriangle,
  Loader2,
  MousePointerClick,
  Zap,
} from 'lucide-react';
import './BrowserMirror.css';

interface ConsoleLog {
  type: string;
  text: string;
  timestamp: number;
}

interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  timestamp: number;
}

interface MirrorState {
  url: string;
  viewport: { width: number; height: number };
  screenshot: string | null;
  consoleLogs: ConsoleLog[];
  networkRequests: NetworkRequest[];
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_STATE: MirrorState = {
  url: 'about:blank',
  viewport: { width: 1280, height: 720 },
  screenshot: null,
  consoleLogs: [],
  networkRequests: [],
  isLoading: false,
  error: null,
};

const VIEWPORT_PRESETS = [
  { name: 'Desktop', width: 1280, height: 720, icon: Monitor },
  { name: 'Tablet', width: 768, height: 1024, icon: Tablet },
  { name: 'Mobile', width: 375, height: 812, icon: Smartphone },
  { name: 'Full', width: 0, height: 0, icon: Maximize },
];

export default function BrowserMirror() {
  const [state, setState] = useState<MirrorState>(DEFAULT_STATE);
  const [inputUrl, setInputUrl] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const [activePanel, setActivePanel] = useState<'console' | 'network' | null>(null);
  const screenshotRef = useRef<HTMLImageElement>(null);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'bmState': {
          setState((prev) => ({ ...prev, ...message.state }));
          if (message.state.url) {
            setInputUrl(message.state.url);
          }
          break;
        }
        case 'bmScreenshot': {
          setState((prev) => ({ ...prev, screenshot: message.screenshot }));
          break;
        }
        case 'bmConsoleLog': {
          setState((prev) => ({
            ...prev,
            consoleLogs: [...prev.consoleLogs, message.log],
          }));
          break;
        }
        case 'bmNetworkRequest': {
          setState((prev) => ({
            ...prev,
            networkRequests: [...prev.networkRequests, message.request],
          }));
          break;
        }
        case 'bmLogsCleared': {
          setState((prev) => ({ ...prev, consoleLogs: [], networkRequests: [] }));
          break;
        }
        case 'bmError': {
          setState((prev) => ({ ...prev, error: message.error, isLoading: false }));
          break;
        }
        case 'bmDetectedUrl': {
          if (message.url) {
            setInputUrl(message.url);
            navigate(message.url);
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Request auto-detection of localhost on mount
    window.vscode?.postMessage({ type: 'bmDetectLocalhost' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const navigate = useCallback((url: string) => {
    if (!url.trim()) return;
    window.vscode?.postMessage({ type: 'bmNavigate', url: url.trim() });
  }, []);

  const handleScreenshotClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!screenshotRef.current || state.isLoading) return;

      const rect = screenshotRef.current.getBoundingClientRect();
      const scaleX = state.viewport.width / rect.width;
      const scaleY = state.viewport.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      window.vscode?.postMessage({ type: 'bmClick', x, y });
    },
    [state.viewport, state.isLoading]
  );

  const handleScreenshotWheel = useCallback(
    (e: React.WheelEvent<HTMLImageElement>) => {
      e.preventDefault();
      if (state.isLoading) return;
      window.vscode?.postMessage({
        type: 'bmScroll',
        deltaX: e.deltaX,
        deltaY: e.deltaY,
      });
    },
    [state.isLoading]
  );

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (state.isLoading) return;
      if (e.key.length === 1) {
        window.vscode?.postMessage({ type: 'bmType', text: e.key });
      }
    },
    [state.isLoading]
  );

  const setViewport = useCallback((width: number, height: number) => {
    window.vscode?.postMessage({ type: 'bmViewport', width, height });
  }, []);

  const refresh = useCallback(() => {
    window.vscode?.postMessage({ type: 'bmRefresh' });
  }, []);

  const clearLogs = useCallback(() => {
    window.vscode?.postMessage({ type: 'bmClearLogs' });
  }, []);

  const togglePanel = (panel: 'console' | 'network') => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="browser-mirror" tabIndex={0} onKeyPress={handleKeyPress}>
      {/* Toolbar */}
      <div className="bm-toolbar">
        <div className="bm-url-bar">
          <Globe size={14} className="bm-url-icon" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(inputUrl);
            }}
            placeholder="Enter URL or localhost port..."
            className="bm-url-input"
          />
          <button
            className="bm-icon-button"
            onClick={refresh}
            disabled={state.isLoading}
            title="Refresh"
          >
            <RefreshCw size={14} className={state.isLoading ? 'bm-spin' : ''} />
          </button>
        </div>

        <div className="bm-viewport-presets">
          {VIEWPORT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              className="bm-preset-button"
              onClick={() => setViewport(preset.width, preset.height)}
              title={`${preset.name} (${preset.width}x${preset.height})`}
            >
              <preset.icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Viewport info */}
      <div className="bm-viewport-info">
        <span className="bm-dimensions">
          {state.viewport.width} x {state.viewport.height}
        </span>
        {state.isLoading && (
          <span className="bm-loading">
            <Loader2 size={12} className="bm-spin" />
            Loading...
          </span>
        )}
        {state.error && (
          <span className="bm-error-text">
            <AlertTriangle size={12} />
            {state.error}
          </span>
        )}
      </div>

      {/* Screenshot Canvas */}
      <div className="bm-canvas">
        {state.screenshot ? (
          <img
            ref={screenshotRef}
            src={state.screenshot}
            alt="Browser preview"
            className="bm-screenshot"
            onClick={handleScreenshotClick}
            onWheel={handleScreenshotWheel}
            draggable={false}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              cursor: 'crosshair',
            }}
          />
        ) : (
          <div className="bm-placeholder">
            <MousePointerClick size={48} className="bm-placeholder-icon" />
            <p className="bm-placeholder-text">Enter a URL to start browsing</p>
            <p className="bm-placeholder-sub">Auto-detecting localhost servers...</p>
          </div>
        )}
      </div>

      {/* Bottom Panels */}
      <div className="bm-bottom-panels">
        {/* Panel Tabs */}
        <div className="bm-panel-tabs">
          <button
            className={`bm-tab ${activePanel === 'console' ? 'bm-tab-active' : ''}`}
            onClick={() => togglePanel('console')}
          >
            <Terminal size={14} />
            Console
            {state.consoleLogs.length > 0 && (
              <span className="bm-badge">{state.consoleLogs.length}</span>
            )}
            {activePanel === 'console' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            className={`bm-tab ${activePanel === 'network' ? 'bm-tab-active' : ''}`}
            onClick={() => togglePanel('network')}
          >
            <Network size={14} />
            Network
            {state.networkRequests.length > 0 && (
              <span className="bm-badge">{state.networkRequests.length}</span>
            )}
            {activePanel === 'network' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button className="bm-tab" onClick={clearLogs} title="Clear all logs">
            <Zap size={14} />
            Clear
          </button>
        </div>

        {/* Console Panel */}
        {activePanel === 'console' && (
          <div className="bm-panel bm-console-panel">
            {state.consoleLogs.length === 0 ? (
              <p className="bm-panel-empty">No console logs yet</p>
            ) : (
              <div className="bm-log-list">
                {state.consoleLogs.map((log, i) => (
                  <div key={i} className={`bm-log-item bm-log-${log.type}`}>
                    <span className="bm-log-type">[{log.type}]</span>
                    <span className="bm-log-text">{log.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Network Panel */}
        {activePanel === 'network' && (
          <div className="bm-panel bm-network-panel">
            {state.networkRequests.length === 0 ? (
              <p className="bm-panel-empty">No network requests yet</p>
            ) : (
              <div className="bm-request-list">
                {state.networkRequests.map((req, i) => (
                  <div key={i} className="bm-request-item">
                    <span className={`bm-request-status ${req.status >= 400 ? 'bm-error' : ''}`}>
                      {req.status}
                    </span>
                    <span className="bm-request-method">{req.method}</span>
                    <span className="bm-request-url" title={req.url}>
                      {req.url.length > 60 ? req.url.slice(0, 60) + '...' : req.url}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
