/**
 * Time Formatting Utilities
 * Converts milliseconds to human-readable format
 */

/**
 * Format milliseconds to human-readable time string
 * Examples:
 *   500ms → "500ms"
 *   1500ms → "1s 500ms"
 *   65000ms → "1m 5s"
 *   3661000ms → "1h 1m 1s"
 *
 * @param ms Milliseconds
 * @returns Formatted time string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.round(ms % 1000);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0) {
    parts.push(`${seconds}s`);
  }
  if (milliseconds > 0 && ms < 60000) {
    // Only show ms if total time is less than 1 minute
    parts.push(`${milliseconds}ms`);
  }

  return parts.join(' ');
}

/**
 * Format milliseconds to short format
 * Examples:
 *   500ms → "500ms"
 *   1500ms → "1.5s"
 *   65000ms → "1m 5s"
 *
 * @param ms Milliseconds
 * @returns Formatted time string (short)
 */
export function formatDurationShort(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  if (ms < 60000) {
    const seconds = ms / 1000;
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

/**
 * Format milliseconds to verbose format
 * Examples:
 *   500ms → "500 milliseconds"
 *   1500ms → "1 second 500 milliseconds"
 *   65000ms → "1 minute 5 seconds"
 *
 * @param ms Milliseconds
 * @returns Formatted time string (verbose)
 */
export function formatDurationVerbose(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)} millisecond${Math.round(ms) !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }
  if (seconds > 0) {
    parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return '0 seconds';
  }

  if (parts.length === 1) {
    return parts[0];
  }

  // Join with commas and "and"
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}
