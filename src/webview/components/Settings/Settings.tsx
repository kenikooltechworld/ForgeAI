import React, { useState, useEffect } from 'react';
import { useConversationStore } from '../../store/conversationStore';
import {
  Settings as SettingsIcon,
  Check,
  Camera,
  Brain,
  Cloud,
  Download,
  AlertTriangle,
  Clock,
  Lightbulb,
} from 'lucide-react';
import './Settings.css';

interface SettingsProps {
  onClose: () => void;
}

interface OllamaModel {
  name: string;
  displayName: string;
  type: 'cloud' | 'local';
  capabilities: string[];
  contextWindow: string;
  vram?: string;
  installed?: boolean;
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  // Get state from store
  const selectedModel = useConversationStore((state) => state.selectedModel);
  const setSelectedModel = useConversationStore((state) => state.setSelectedModel);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const updateConversationModel = useConversationStore((state) => state.updateConversationModel);
  const showThinking = useConversationStore((state) => state.showThinking);
  const setShowThinking = useConversationStore((state) => state.setShowThinking);
  const autonomyLevel = useConversationStore((state) => state.autonomyLevel);
  const setAutonomyLevel = useConversationStore((state) => state.setAutonomyLevel);

  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);

  // Curated list of 10 models (5 cloud + 5 local)
  const curatedModels: OllamaModel[] = [
    // Cloud Models
    {
      name: 'gpt-oss:120b-cloud',
      displayName: 'GPT-OSS-120B (Cloud)',
      type: 'cloud',
      capabilities: ['Tools ✓'],
      contextWindow: '128K',
    },
    {
      name: 'gemma4:31b-cloud',
      displayName: 'Gemma4-31B (Cloud)',
      type: 'cloud',
      capabilities: ['Tools ✓', 'Vision'],
      contextWindow: '128K',
    },
    {
      name: 'qwen3.5:397b-cloud',
      displayName: 'Qwen3.5-397B (Cloud)',
      type: 'cloud',
      capabilities: ['Tools ✓', 'Thinking'],
      contextWindow: '128K',
    },
    {
      name: 'deepseek-v3.1:671b-cloud',
      displayName: 'DeepSeek-V3.1-671B (Cloud)',
      type: 'cloud',
      capabilities: ['Tools ✓', 'Thinking'],
      contextWindow: '128K',
    },
    {
      name: 'kimi-k2.5:cloud',
      displayName: 'Kimi-K2.5 (Cloud)',
      type: 'cloud',
      capabilities: ['Tools ✓', 'Vision'],
      contextWindow: '128K',
    },
    // Local Models
    {
      name: 'qwen3-vl:8b',
      displayName: 'Qwen3-VL-8B',
      type: 'local',
      capabilities: ['Vision', 'Tools ✓'],
      contextWindow: '32K',
      vram: '~6GB VRAM',
    },
    {
      name: 'qwen3-coder:30b',
      displayName: 'Qwen3-Coder-30B',
      type: 'local',
      capabilities: ['Tools ✓'],
      contextWindow: '32K',
      vram: '~20GB VRAM',
    },
    {
      name: 'deepseek-r1:8b',
      displayName: 'DeepSeek-R1-8B',
      type: 'local',
      capabilities: ['Tools ✓', 'Thinking'],
      contextWindow: '32K',
      vram: '~6GB VRAM',
    },
    {
      name: 'gemma4:e4b',
      displayName: 'Gemma4-E4B',
      type: 'local',
      capabilities: ['Tools ✓'],
      contextWindow: '8K',
      vram: '~3GB VRAM',
    },
    {
      name: 'qwen3.5:9b',
      displayName: 'Qwen3.5-9B',
      type: 'local',
      capabilities: ['Tools ✓'],
      contextWindow: '32K',
      vram: '~6GB VRAM',
    },
  ];

  useEffect(() => {
    // Fetch available models from Ollama API via extension proxy
    fetchAvailableModels();

    // Refresh every 5 minutes
    const interval = setInterval(
      () => {
        fetchAvailableModels();
      },
      5 * 60 * 1000
    ); // 5 minutes

    // Listen for response from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'ollamaModelsResponse') {
        handleOllamaModelsResponse(message);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const fetchAvailableModels = () => {
    setIsLoadingModels(true);
    setModelFetchError(null);

    // Send message to extension to fetch models (avoids CORS)
    window.vscode.postMessage({
      type: 'fetchOllamaModels',
    });
  };

  const handleOllamaModelsResponse = (message: any) => {
    if (message.success) {
      const data = message.data;
      const installedModelNames = new Set(data.models?.map((m: any) => m.name) || []);

      // Update curated models with installation status
      const modelsWithStatus = curatedModels.map((model) => ({
        ...model,
        installed: model.type === 'cloud' ? true : installedModelNames.has(model.name),
      }));

      setAvailableModels(modelsWithStatus);
      setIsLoadingModels(false);
    } else {
      // Handle structured error response
      const errorDetails = message.error;

      // Format error message with title, message, and steps
      let formattedError = '';

      if (typeof errorDetails === 'string') {
        // Backward compatibility: handle simple string errors
        formattedError = errorDetails;
      } else if (errorDetails && typeof errorDetails === 'object') {
        // Structured error with title, message, and steps
        formattedError = `${errorDetails.title}: ${errorDetails.message}`;

        if (errorDetails.steps && errorDetails.steps.length > 0) {
          formattedError += '\n\nSteps to fix:\n';
          errorDetails.steps.forEach((step: string, index: number) => {
            if (step.trim()) {
              formattedError += `${index + 1}. ${step}\n`;
            } else {
              formattedError += '\n';
            }
          });
        }
      } else {
        // Fallback
        formattedError = 'Cannot connect to Ollama. Please ensure Ollama is running.';
      }

      setModelFetchError(formattedError);

      // Fallback to curated list with all local models marked as not installed
      const modelsWithStatus = curatedModels.map((model) => ({
        ...model,
        installed: model.type === 'cloud' ? true : false,
      }));

      setAvailableModels(modelsWithStatus);
      setIsLoadingModels(false);
    }
  };

  const handleSave = () => {
    // Save settings to VS Code storage
    console.log('Saving settings:', { showThinking, autonomyLevel, selectedModel });

    // Update active conversation's model if one is active
    if (activeConversationId) {
      updateConversationModel(activeConversationId, selectedModel);
    }

    onClose();
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);

    // Update active conversation's model immediately
    if (activeConversationId) {
      updateConversationModel(activeConversationId, model);
    }
  };

  const cloudModels = availableModels.filter((m) => m.type === 'cloud');
  const localModels = availableModels.filter((m) => m.type === 'local');

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title flex items-center gap-2">
            <SettingsIcon size={20} style={{ color: 'var(--vscode-editor-foreground)' }} />
            ForgeAI Settings
          </h2>
          <button className="settings-close-button" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="settings-content">
          {/* Model Configuration Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">Model Configuration</h3>

            {/* Loading State */}
            {isLoadingModels && (
              <div className="settings-loading">
                <Clock
                  size={16}
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                  className="settings-loading-spinner"
                />
                <span>Loading models from Ollama...</span>
              </div>
            )}

            {/* Error State */}
            {modelFetchError && (
              <div className="settings-error">
                <AlertTriangle
                  size={18}
                  style={{ color: 'var(--vscode-errorForeground)' }}
                  className="settings-error-icon"
                />
                <span>{modelFetchError}</span>
              </div>
            )}

            <div className="settings-field">
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="settings-select"
                disabled={isLoadingModels}
              >
                {/* Cloud Models */}
                <optgroup label="Cloud Models">
                  {cloudModels.map((model) => {
                    const capabilityIcons = model.capabilities
                      .map((cap) => {
                        if (cap === 'Vision') return '📷';
                        if (cap === 'Thinking') return '🧠';
                        return cap;
                      })
                      .join(' | ');
                    return (
                      <option key={model.name} value={model.name}>
                        {model.displayName} - {capabilityIcons} | {model.contextWindow}
                      </option>
                    );
                  })}
                </optgroup>

                {/* Local Models */}
                <optgroup label="Local Models">
                  {localModels.map((model) => {
                    const capabilityIcons = model.capabilities
                      .map((cap) => {
                        if (cap === 'Vision') return '📷';
                        if (cap === 'Thinking') return '🧠';
                        return cap;
                      })
                      .join(' | ');
                    return (
                      <option key={model.name} value={model.name}>
                        {model.installed ? '✓' : '↓'} {model.displayName} - {capabilityIcons} |{' '}
                        {model.contextWindow} | {model.vram}
                      </option>
                    );
                  })}
                </optgroup>
              </select>

              <p className="settings-description">
                {selectedModel === 'gpt-oss:120b-cloud'
                  ? 'Fast, intelligent, and ready to help (Auto-selected)'
                  : 'Select a model based on your task requirements'}
              </p>

              {/* Show installation hint for local models */}
              {selectedModel &&
                availableModels.find((m) => m.name === selectedModel)?.type === 'local' &&
                !availableModels.find((m) => m.name === selectedModel)?.installed && (
                  <p className="settings-warning flex items-center gap-2">
                    <AlertTriangle
                      size={16}
                      style={{ color: 'var(--vscode-editorWarning-foreground)' }}
                    />
                    This model is not installed. Run: ollama pull {selectedModel}
                  </p>
                )}
            </div>
          </section>

          {/* Autonomy Level Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">Autonomy Level</h3>
            <div className="settings-field">
              <label className="settings-radio-label">
                <input
                  type="radio"
                  name="autonomy"
                  value="supervised"
                  checked={autonomyLevel === 'supervised'}
                  onChange={(e) => setAutonomyLevel(e.target.value as any)}
                />
                <span className="settings-radio-text">
                  <strong>Supervised</strong> - Ask before every action
                </span>
              </label>

              <label className="settings-radio-label">
                <input
                  type="radio"
                  name="autonomy"
                  value="semi-autonomous"
                  checked={autonomyLevel === 'semi-autonomous'}
                  onChange={(e) => setAutonomyLevel(e.target.value as any)}
                />
                <span className="settings-radio-text">
                  <strong>Semi-Autonomous</strong> - Ask for unusual actions (recommended)
                </span>
              </label>

              <label className="settings-radio-label">
                <input
                  type="radio"
                  name="autonomy"
                  value="autonomous"
                  checked={autonomyLevel === 'autonomous'}
                  onChange={(e) => setAutonomyLevel(e.target.value as any)}
                />
                <span className="settings-radio-text">
                  <strong>Autonomous</strong> - Act independently
                </span>
              </label>
            </div>
          </section>

          {/* Thinking Visibility Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">Thinking Visibility</h3>
            <div className="settings-field">
              <label className="settings-radio-label">
                <input
                  type="radio"
                  name="thinking"
                  value="show"
                  checked={showThinking}
                  onChange={() => setShowThinking(true)}
                />
                <span className="settings-radio-text">
                  <strong>Show thinking process</strong> (recommended)
                </span>
              </label>
              <p className="settings-description">See how ForgeAI reasons through problems</p>

              <label className="settings-radio-label">
                <input
                  type="radio"
                  name="thinking"
                  value="hide"
                  checked={!showThinking}
                  onChange={() => setShowThinking(false)}
                />
                <span className="settings-radio-text">
                  <strong>Hide thinking process</strong>
                </span>
              </label>
              <p className="settings-description">Show only results</p>
            </div>
          </section>

          {/* Keyboard Shortcut Hint */}
          <section className="settings-section">
            <div className="settings-hint">
              <Lightbulb
                size={16}
                style={{ color: 'var(--vscode-descriptionForeground)' }}
                className="settings-hint-icon"
              />
              <span className="settings-hint-text">
                Tip: Use <kbd>Cmd+/</kbd> (Mac) or <kbd>Ctrl+/</kbd> (Windows/Linux) to quickly
                toggle thinking visibility
              </span>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button className="settings-button settings-button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="settings-button settings-button-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
