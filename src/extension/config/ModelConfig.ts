import * as vscode from 'vscode';

/**
 * Central model configuration for ForgeAI.
 *
 * The default model is read from VS Code settings (forgeai.selectedModel
 * set by the webview settings panel). All extension code that needs
 * the current model should call getConfiguredModel() instead of using
 * a hard-coded fallback.
 */

/** Fallback model only used when no setting exists. */
const FALLBACK_MODEL = 'gemma4-31b-cloud';

/** Read the user's selected model from VS Code settings. */
export function getConfiguredModel(): string {
  const config = vscode.workspace.getConfiguration('forgeai');
  const model = config.get<string>('model', '');
  if (model) return model;

  return FALLBACK_MODEL;
}

/** @deprecated Use getConfiguredModel() instead. Kept for backwards compatibility. */
export const DEFAULT_MODEL = FALLBACK_MODEL;

/** List of vision-model name fragments for quick detection. */
export const VISION_MODEL_FRAGMENTS = ['llava', 'vision', 'bakllava', 'moondream', 'gemma4'];

/**
 * Check whether a model identifier supports image/vision input.
 */
export function isVisionModel(model: string): boolean {
  return VISION_MODEL_FRAGMENTS.some((frag) => model.includes(frag));
}
