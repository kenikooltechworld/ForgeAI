interface OnboardingTooltipProps {
  content: string;
  onGotIt: () => void;
  onDontShowAgain: () => void;
}

function OnboardingTooltip({ content, onGotIt, onDontShowAgain }: OnboardingTooltipProps) {
  return (
    <div className="rounded border border-(--vscode-input-border) bg-(--vscode-panel-background) p-3">
      {/* Tooltip content */}
      <div className="mb-3 text-sm text-(--vscode-editor-foreground)">{content}</div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onGotIt}
          className="rounded bg-(--vscode-button-background) px-3 py-1 text-xs text-(--vscode-button-foreground) transition hover:opacity-80"
        >
          Got it
        </button>
        <button
          onClick={onDontShowAgain}
          className="btn-secondary rounded px-3 py-1 text-xs transition hover:opacity-80"
        >
          Don't show again
        </button>
      </div>
    </div>
  );
}

export default OnboardingTooltip;
