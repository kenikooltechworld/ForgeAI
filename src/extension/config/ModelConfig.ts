/**
 * Central model configuration for ForgeAI.
 *
 * The default model is defined in ONE place. All extension code that needs
 * a fallback should import DEFAULT_MODEL from here instead of hard-coding
 * a model name.
 */

/** Default model used when the user has not selected one. */
export const DEFAULT_MODEL = 'gpt-oss:120b-cloud';

/** List of vision-model name fragments for quick detection. */
export const VISION_MODEL_FRAGMENTS = [
  'llava',
  'vision',
  'bakllava',
  'moondream',
  'gemma4',
];

/**
 * Check whether a model identifier supports image/vision input.
 */
export function isVisionModel(model: string): boolean {
  return VISION_MODEL_FRAGMENTS.some((frag) => model.includes(frag));
}
