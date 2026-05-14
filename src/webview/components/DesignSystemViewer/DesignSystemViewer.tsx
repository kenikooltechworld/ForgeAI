/**
 * Design System Viewer Panel — Phase 5.3
 * View generated design tokens, color swatches, typography, spacing
 */

import { useState } from 'react';
import { Palette, Type, Box, Layers, Download, Accessibility, CheckCircle } from 'lucide-react';

interface ColorScale {
  [weight: string]: string;
}

interface DesignTokens {
  name: string;
  version: string;
  colors: Record<string, ColorScale>;
  semanticColors: Record<string, Record<string, string>>;
  typography: {
    heading: Record<string, { size: string; weight: number }>;
    body: Record<string, { size: string }>;
    ui: Record<string, { size: string }>;
  };
  spacing: { scale: Record<string, string> };
  shadows: { elevation: Record<string, string> };
  radius: { scale: Record<string, string> };
  breakpoints: Record<string, string>;
}

interface AccessibilityReport {
  totalPairs: number;
  passingAA: number;
  passingAAA: number;
  issues: Array<{
    foreground: string;
    background: string;
    ratio: number;
    requirement: string;
  }>;
}

interface DesignSystemViewerProps {
  tokens: DesignTokens;
  accessibilityReport?: AccessibilityReport;
  onExportJson: () => void;
  onExportCss: () => void;
  onExportTailwind: () => void;
}

type TabId = 'colors' | 'semantic' | 'typography' | 'spacing' | 'shadows' | 'accessibility';

export default function DesignSystemViewer({
  tokens,
  accessibilityReport,
  onExportJson,
  onExportCss,
  onExportTailwind,
}: DesignSystemViewerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('colors');

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'colors', label: 'Colors', icon: <Palette size={14} /> },
    { id: 'semantic', label: 'Semantic', icon: <Layers size={14} /> },
    { id: 'typography', label: 'Type', icon: <Type size={14} /> },
    { id: 'spacing', label: 'Spacing', icon: <Box size={14} /> },
    { id: 'shadows', label: 'Shadows', icon: <Layers size={14} /> },
    { id: 'accessibility', label: 'A11y', icon: <Accessibility size={14} /> },
  ];

  return (
    <div className="h-full flex flex-col bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-(--vscode-panel-border)">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{tokens.name}</h2>
            <p className="text-[10px] text-(--vscode-descriptionForeground)">v{tokens.version}</p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={onExportJson}
              className="text-[10px] px-2 py-1 rounded border border-(--vscode-panel-border) hover:bg-(--vscode-toolbar-hoverBackground) flex items-center gap-1"
            >
              <Download size={10} /> JSON
            </button>
            <button
              onClick={onExportCss}
              className="text-[10px] px-2 py-1 rounded border border-(--vscode-panel-border) hover:bg-(--vscode-toolbar-hoverBackground) flex items-center gap-1"
            >
              <Download size={10} /> CSS
            </button>
            <button
              onClick={onExportTailwind}
              className="text-[10px] px-2 py-1 rounded border border-(--vscode-panel-border) hover:bg-(--vscode-toolbar-hoverBackground) flex items-center gap-1"
            >
              <Download size={10} /> Tailwind
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-(--vscode-panel-border) overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap
              ${
                activeTab === tab.id
                  ? 'border-(--vscode-focusBorder) text-(--vscode-editor-foreground)'
                  : 'border-transparent text-(--vscode-descriptionForeground) hover:text-(--vscode-editor-foreground)'
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'colors' && <ColorTab colors={tokens.colors} />}
        {activeTab === 'semantic' && <SemanticTab semantic={tokens.semanticColors} />}
        {activeTab === 'typography' && <TypographyTab typography={tokens.typography} />}
        {activeTab === 'spacing' && <SpacingTab spacing={tokens.spacing} />}
        {activeTab === 'shadows' && <ShadowsTab shadows={tokens.shadows} />}
        {activeTab === 'accessibility' && (
          <AccessibilityTab report={accessibilityReport} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ColorTab({ colors }: { colors: Record<string, ColorScale> }) {
  return (
    <div className="space-y-4">
      {Object.entries(colors).map(([name, scale]) => (
        <div key={name}>
          <h3 className="text-xs font-semibold capitalize mb-2 text-(--vscode-descriptionForeground)">
            {name}
          </h3>
          <div className="grid grid-cols-6 gap-1">
            {Object.entries(scale).map(([weight, value]) => (
              <div key={weight} className="group">
                <div
                  className="h-12 rounded border border-(--vscode-panel-border) relative"
                  style={{ backgroundColor: value }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 text-white rounded">
                    {value}
                  </span>
                </div>
                <div className="text-[9px] text-center mt-0.5 text-(--vscode-descriptionForeground)">
                  {weight}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SemanticTab({ semantic }: { semantic: Record<string, Record<string, string>> }) {
  return (
    <div className="space-y-4">
      {Object.entries(semantic).map(([category, values]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold capitalize mb-2 text-(--vscode-descriptionForeground)">
            {category}
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(values).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-2 px-2 py-1.5 rounded border border-(--vscode-panel-border) text-xs"
              >
                <div
                  className="w-4 h-4 rounded border border-(--vscode-panel-border) shrink-0"
                  style={{ backgroundColor: value }}
                />
                <div>
                  <div className="font-medium">{key}</div>
                  <div className="text-[10px] text-(--vscode-descriptionForeground) font-mono">
                    {value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TypographyTab({
  typography,
}: {
  typography: DesignTokens['typography'];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold mb-2 text-(--vscode-descriptionForeground)">Headings</h3>
        {Object.entries(typography.heading).map(([key, val]) => (
          <div key={key} className="py-2 border-b border-(--vscode-panel-border)">
            <div className="text-[10px] uppercase text-(--vscode-descriptionForeground) mb-1">{key}</div>
            <div style={{ fontSize: val.size, fontWeight: val.weight }}>
              The quick brown fox jumps
            </div>
            <div className="text-[10px] text-(--vscode-descriptionForeground) mt-1">
              {val.size} / weight {val.weight}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-xs font-semibold mb-2 text-(--vscode-descriptionForeground)">Body</h3>
        {Object.entries(typography.body).map(([key, val]) => (
          <div key={key} className="py-2 border-b border-(--vscode-panel-border)">
            <div className="text-[10px] uppercase text-(--vscode-descriptionForeground) mb-1">{key}</div>
            <div style={{ fontSize: val.size }}>
              The quick brown fox jumps over the lazy dog.
            </div>
            <div className="text-[10px] text-(--vscode-descriptionForeground) mt-1">{val.size}</div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-xs font-semibold mb-2 text-(--vscode-descriptionForeground)">UI</h3>
        {Object.entries(typography.ui).map(([key, val]) => (
          <div key={key} className="py-2 border-b border-(--vscode-panel-border)">
            <div className="text-[10px] uppercase text-(--vscode-descriptionForeground) mb-1">{key}</div>
            <div style={{ fontSize: val.size }}>{key} — Action, Label</div>
            <div className="text-[10px] text-(--vscode-descriptionForeground) mt-1">{val.size}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpacingTab({ spacing }: { spacing: DesignTokens['spacing'] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold mb-2 text-(--vscode-descriptionForeground)">Spacing Scale</h3>
      <div className="space-y-1">
        {Object.entries(spacing.scale).map(([key, value]) => (
          <div key={key} className="flex items-center gap-3 text-xs">
            <span className="w-8 text-right text-(--vscode-descriptionForeground)">{key}</span>
            <div
              className="h-4 bg-(--vscode-button-background) rounded"
              style={{ width: value }}
            />
            <span className="text-(--vscode-descriptionForeground)">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShadowsTab({ shadows }: { shadows: DesignTokens['shadows'] }) {
  return (
    <div className="space-y-3">
      {Object.entries(shadows.elevation).map(([key, value]) => (
        <div
          key={key}
          className="p-4 rounded border border-(--vscode-panel-border) text-center text-xs"
          style={{ boxShadow: value }}
        >
          {key === '0' ? 'None' : `Elevation ${key}`}
        </div>
      ))}
    </div>
  );
}

function AccessibilityTab({ report }: { report?: AccessibilityReport }) {
  if (!report) {
    return (
      <div className="text-center text-sm text-(--vscode-descriptionForeground) py-8">
        <Accessibility size={32} className="mx-auto mb-3 opacity-50" />
        No accessibility report available.
        <br />
        Run a contrast check to generate a report.
      </div>
    );
  }

  const aaPercent = (report.passingAA / report.totalPairs) * 100;
  const aaaPercent = (report.passingAAA / report.totalPairs) * 100;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded border border-(--vscode-panel-border) text-center">
          <div className="text-lg font-semibold">{report.totalPairs}</div>
          <div className="text-[10px] text-(--vscode-descriptionForeground)">Pairs Tested</div>
        </div>
        <div className="p-3 rounded border border-(--vscode-panel-border) text-center">
          <div className="text-lg font-semibold text-green-400">{report.passingAA}</div>
          <div className="text-[10px] text-(--vscode-descriptionForeground)">WCAG AA Pass</div>
        </div>
        <div className="p-3 rounded border border-(--vscode-panel-border) text-center">
          <div className="text-lg font-semibold text-green-400">{report.passingAAA}</div>
          <div className="text-[10px] text-(--vscode-descriptionForeground)">WCAG AAA Pass</div>
        </div>
      </div>

      {/* Progress bars */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span>AA Compliance</span>
          <span>{aaPercent.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-(--vscode-editor-inactiveSelectionBackground) rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full"
            style={{ width: `${aaPercent}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span>AAA Compliance</span>
          <span>{aaaPercent.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-(--vscode-editor-inactiveSelectionBackground) rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full"
            style={{ width: `${aaaPercent}%` }}
          />
        </div>
      </div>

      {/* Issues */}
      {report.issues.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold mb-2 text-red-400 flex items-center gap-1">
            <XCircle size={14} /> Issues ({report.issues.length})
          </h3>
          <div className="space-y-1">
            {report.issues.map((issue, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded border border-red-500/20 text-xs"
              >
                <div className="flex gap-1">
                  <div
                    className="w-4 h-4 rounded border border-(--vscode-panel-border)"
                    style={{ backgroundColor: issue.foreground }}
                  />
                  <div
                    className="w-4 h-4 rounded border border-(--vscode-panel-border)"
                    style={{ backgroundColor: issue.background }}
                  />
                </div>
                <span className="flex-1">{issue.requirement}</span>
                <span className="text-(--vscode-descriptionForeground)">
                  {issue.ratio.toFixed(2)}:1
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.issues.length === 0 && (
        <div className="text-center py-4 text-green-400 flex items-center justify-center gap-2">
          <CheckCircle size={16} /> All pairs pass WCAG AA
        </div>
      )}
    </div>
  );
}

function XCircle(props: { size: number; className?: string }) {
  return (
    <svg
      width={props.size}
      height={props.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
