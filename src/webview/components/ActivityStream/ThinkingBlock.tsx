import { useState } from 'react';
import { Brain, CheckCircle, AlertTriangle, Circle, ChevronUp, ChevronDown } from 'lucide-react';
import { useConversationStore } from '../../store/conversationStore';

interface ThinkingBlockProps {
  thinking: string;
  tokenUsage?: {
    thinkingTokens?: number;
    totalTokens?: number;
  };
}

type ConfidenceLevel = 'high' | 'medium' | 'low';

function ThinkingBlock({ thinking, tokenUsage }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);

  // Get thinking visibility from store (Requirement 49.2)
  const showThinking = useConversationStore((state) => state.showThinking);

  // Calculate confidence based on language patterns (Requirement 33.3)
  const confidence = calculateConfidence(thinking);

  const firstLine = thinking.split('\n')[0];

  // Hide thinking block if showThinking is false (Requirement 49.2)
  if (!showThinking) {
    return null;
  }

  return (
    <>
      {/* Thinking Block with border color-coding (Requirement 33.2) */}
      <div
        className={`rounded border-2 p-3 bg-(--vscode-textBlockQuote-background) thinking-block-${confidence}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={18} style={{ color: 'var(--vscode-editor-foreground)' }} />
            <span className="text-sm font-semibold">Thinking</span>
            {/* Confidence badge (Requirement 33.2) */}
            <span
              className={`confidence-badge confidence-badge-${confidence} flex items-center gap-1`}
            >
              {confidence === 'high' ? (
                <>
                  <CheckCircle size={14} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
                  High
                </>
              ) : confidence === 'medium' ? (
                <>
                  <AlertTriangle
                    size={14}
                    style={{ color: 'var(--vscode-editorWarning-foreground)' }}
                  />
                  Medium
                </>
              ) : (
                <>
                  <Circle size={14} style={{ color: 'var(--vscode-errorForeground)' }} />
                  Low
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-(--vscode-textLink-foreground) hover:underline flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                Collapse{' '}
                <ChevronUp size={14} style={{ color: 'var(--vscode-textLink-foreground)' }} />
              </>
            ) : (
              <>
                Expand{' '}
                <ChevronDown size={14} style={{ color: 'var(--vscode-textLink-foreground)' }} />
              </>
            )}
          </button>
        </div>

        <div className="mt-2">
          {isExpanded ? (
            <div className="whitespace-pre-wrap text-sm text-(--vscode-editor-foreground)">
              {thinking}
            </div>
          ) : (
            <div className="text-sm text-(--vscode-descriptionForeground)">{firstLine}...</div>
          )}
        </div>

        {/* Expanded state: Why button and token usage (Requirements 33.4, 33.6) */}
        {isExpanded && (
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowWhyModal(true)}
              className="rounded border border-button bg-button px-3 py-1 text-xs text-button hover:bg-button-hover transition-colors"
            >
              Why this approach?
            </button>

            {/* Token usage display (Requirement 33.6) */}
            {tokenUsage && (tokenUsage.thinkingTokens || tokenUsage.totalTokens) && (
              <span className="text-xs text-(--vscode-descriptionForeground)">
                {tokenUsage.thinkingTokens !== undefined && (
                  <>Thinking tokens: {tokenUsage.thinkingTokens}</>
                )}
                {tokenUsage.thinkingTokens !== undefined &&
                  tokenUsage.totalTokens !== undefined && <> | </>}
                {tokenUsage.totalTokens !== undefined && <>Total: {tokenUsage.totalTokens}</>}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Why Modal (Requirement 33.4) */}
      {showWhyModal && (
        <DetailedReasoningModal
          thinking={thinking}
          confidence={confidence}
          onClose={() => setShowWhyModal(false)}
        />
      )}
    </>
  );
}

/**
 * Calculate confidence level based on language patterns (Requirement 33.3)
 * Analyzes certainty keywords, hedging language, and question marks
 */
function calculateConfidence(thinking: string): ConfidenceLevel {
  const lowerThinking = thinking.toLowerCase();

  // High confidence indicators (from spec)
  const highConfidenceKeywords = [
    'i found',
    'clearly',
    'definitely',
    'certain',
    'confident',
    'obviously',
    'undoubtedly',
    'without doubt',
  ];

  // Medium confidence indicators (from spec)
  const mediumConfidenceKeywords = [
    'i think',
    'probably',
    'might',
    'could',
    'seems',
    'appears',
    'likely',
    'possibly',
  ];

  // Low confidence indicators (from spec)
  const lowConfidenceKeywords = [
    "i'm not sure",
    'uncertain',
    'unclear',
    'maybe',
    'perhaps',
    'not certain',
    'unsure',
    'difficult to say',
  ];

  // Count occurrences
  const highCount = highConfidenceKeywords.filter((keyword) =>
    lowerThinking.includes(keyword)
  ).length;
  const mediumCount = mediumConfidenceKeywords.filter((keyword) =>
    lowerThinking.includes(keyword)
  ).length;
  const lowCount = lowConfidenceKeywords.filter((keyword) =>
    lowerThinking.includes(keyword)
  ).length;

  // Check for question marks (indicates uncertainty)
  const questionMarkCount = (lowerThinking.match(/\?/g) || []).length;

  // Determine confidence level
  if (lowCount >= 2 || questionMarkCount >= 3) {
    return 'low';
  }

  if (highCount >= 2 && lowCount === 0 && questionMarkCount === 0) {
    return 'high';
  }

  if (highCount >= 1 && lowCount === 0) {
    return 'high';
  }

  if (lowCount >= 1 || questionMarkCount >= 2) {
    return 'low';
  }

  return 'medium';
}

/**
 * Detailed Reasoning Modal Component (Requirement 33.4)
 * Shows structured reasoning with sections for root cause, patterns, etc.
 */
interface DetailedReasoningModalProps {
  thinking: string;
  confidence: ConfidenceLevel;
  onClose: () => void;
}

function DetailedReasoningModal({ thinking, confidence, onClose }: DetailedReasoningModalProps) {
  // Parse thinking to extract structured sections
  const sections = parseThinkingIntoSections(thinking);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--vscode-editor-background)', opacity: 0.95 }}
      onClick={onClose}
    >
      <div
        className="max-w-2xl w-full max-h-[80vh] overflow-y-auto rounded border border-(--vscode-panel-border) bg-(--vscode-panel-background) p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-(--vscode-editor-foreground) flex items-center gap-2">
            <Brain size={20} style={{ color: 'var(--vscode-editor-foreground)' }} />
            Detailed Reasoning
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-(--vscode-descriptionForeground) hover:text-(--vscode-editor-foreground) transition-colors"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Confidence indicator */}
        <div className="mb-4">
          <span
            className={`confidence-badge confidence-badge-${confidence} flex items-center gap-1`}
          >
            {confidence === 'high' ? (
              <>
                <CheckCircle size={14} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
                High Confidence
              </>
            ) : confidence === 'medium' ? (
              <>
                <AlertTriangle
                  size={14}
                  style={{ color: 'var(--vscode-editorWarning-foreground)' }}
                />
                Medium Confidence
              </>
            ) : (
              <>
                <Circle size={14} style={{ color: 'var(--vscode-errorForeground)' }} />
                Low Confidence
              </>
            )}
          </span>
        </div>

        {/* Structured sections */}
        <div className="space-y-4">
          {/* Root Cause Analysis */}
          {sections.rootCause && (
            <div>
              <h3 className="text-sm font-semibold text-(--vscode-editor-foreground) mb-2">
                1. Root Cause Analysis
              </h3>
              <p className="text-sm text-(--vscode-descriptionForeground) whitespace-pre-wrap">
                {sections.rootCause}
              </p>
            </div>
          )}

          {/* Pattern Recognition */}
          {sections.patterns && (
            <div>
              <h3 className="text-sm font-semibold text-(--vscode-editor-foreground) mb-2">
                2. Pattern Recognition
              </h3>
              <p className="text-sm text-(--vscode-descriptionForeground) whitespace-pre-wrap">
                {sections.patterns}
              </p>
            </div>
          )}

          {/* Minimal Change Principle */}
          {sections.minimalChange && (
            <div>
              <h3 className="text-sm font-semibold text-(--vscode-editor-foreground) mb-2">
                3. Minimal Change Principle
              </h3>
              <p className="text-sm text-(--vscode-descriptionForeground) whitespace-pre-wrap">
                {sections.minimalChange}
              </p>
            </div>
          )}

          {/* Data Sources Used */}
          {sections.dataSources && (
            <div>
              <h3 className="text-sm font-semibold text-(--vscode-editor-foreground) mb-2">
                4. Data Sources Used
              </h3>
              <p className="text-sm text-(--vscode-descriptionForeground) whitespace-pre-wrap">
                {sections.dataSources}
              </p>
            </div>
          )}

          {/* Full Thinking (fallback if no structured sections) */}
          {!sections.rootCause &&
            !sections.patterns &&
            !sections.minimalChange &&
            !sections.dataSources && (
              <div>
                <h3 className="text-sm font-semibold text-(--vscode-editor-foreground) mb-2">
                  Reasoning Process
                </h3>
                <p className="text-sm text-(--vscode-descriptionForeground) whitespace-pre-wrap">
                  {thinking}
                </p>
              </div>
            )}
        </div>

        {/* Close button */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-button bg-button px-4 py-2 text-sm text-button hover:bg-button-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Parse thinking text into structured sections
 * Looks for exact section headers from the system prompt
 */
function parseThinkingIntoSections(thinking: string): {
  rootCause?: string;
  patterns?: string;
  minimalChange?: string;
  dataSources?: string;
} {
  const sections: {
    rootCause?: string;
    patterns?: string;
    minimalChange?: string;
    dataSources?: string;
  } = {};

  // Try to find exact section headers first (from system prompt)
  const rootCauseMatch = thinking.match(
    /Root Cause Analysis:?\s*\n([\s\S]*?)(?=\n(?:Pattern Recognition|Minimal Change Principle|Data Sources Used|$))/i
  );
  const patternsMatch = thinking.match(
    /Pattern Recognition:?\s*\n([\s\S]*?)(?=\n(?:Root Cause Analysis|Minimal Change Principle|Data Sources Used|$))/i
  );
  const minimalChangeMatch = thinking.match(
    /Minimal Change Principle:?\s*\n([\s\S]*?)(?=\n(?:Root Cause Analysis|Pattern Recognition|Data Sources Used|$))/i
  );
  const dataSourcesMatch = thinking.match(
    /Data Sources Used:?\s*\n([\s\S]*?)(?=\n(?:Root Cause Analysis|Pattern Recognition|Minimal Change Principle|$))/i
  );

  if (rootCauseMatch) sections.rootCause = rootCauseMatch[1].trim();
  if (patternsMatch) sections.patterns = patternsMatch[1].trim();
  if (minimalChangeMatch) sections.minimalChange = minimalChangeMatch[1].trim();
  if (dataSourcesMatch) sections.dataSources = dataSourcesMatch[1].trim();

  // If exact headers found, return them
  if (Object.keys(sections).length > 0) {
    return sections;
  }

  // Fallback: Try to identify sections based on keywords (old logic)
  const lines = thinking.split('\n');
  let currentSection: 'rootCause' | 'patterns' | 'minimalChange' | 'dataSources' | null = null;
  let sectionContent: string[] = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Detect section headers
    if (
      lowerLine.includes('root cause') ||
      lowerLine.includes('issue') ||
      lowerLine.includes('problem')
    ) {
      if (currentSection && sectionContent.length > 0) {
        sections[currentSection] = sectionContent.join('\n').trim();
      }
      currentSection = 'rootCause';
      sectionContent = [];
    } else if (
      lowerLine.includes('pattern') ||
      lowerLine.includes('common') ||
      lowerLine.includes('similar')
    ) {
      if (currentSection && sectionContent.length > 0) {
        sections[currentSection] = sectionContent.join('\n').trim();
      }
      currentSection = 'patterns';
      sectionContent = [];
    } else if (
      lowerLine.includes('minimal') ||
      lowerLine.includes('approach') ||
      lowerLine.includes('solution')
    ) {
      if (currentSection && sectionContent.length > 0) {
        sections[currentSection] = sectionContent.join('\n').trim();
      }
      currentSection = 'minimalChange';
      sectionContent = [];
    } else if (
      lowerLine.includes('data') ||
      lowerLine.includes('source') ||
      lowerLine.includes('file') ||
      lowerLine.includes('information')
    ) {
      if (currentSection && sectionContent.length > 0) {
        sections[currentSection] = sectionContent.join('\n').trim();
      }
      currentSection = 'dataSources';
      sectionContent = [];
    } else if (currentSection) {
      sectionContent.push(line);
    }
  }

  // Save last section
  if (currentSection && sectionContent.length > 0) {
    sections[currentSection] = sectionContent.join('\n').trim();
  }

  // If no sections were identified, create a generic breakdown
  if (Object.keys(sections).length === 0) {
    const paragraphs = thinking.split('\n\n').filter((p) => p.trim());

    if (paragraphs.length >= 1) {
      sections.rootCause = paragraphs[0];
    }
    if (paragraphs.length >= 2) {
      sections.patterns = paragraphs[1];
    }
    if (paragraphs.length >= 3) {
      sections.minimalChange = paragraphs[2];
    }
    if (paragraphs.length >= 4) {
      sections.dataSources = paragraphs.slice(3).join('\n\n');
    }
  }

  return sections;
}

export default ThinkingBlock;
