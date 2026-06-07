/**
 * BrowserMirror and Visual QA Tool Wrappers
 *
 * These tools expose the BrowserMirrorStream and VisualQAAgent
 * capabilities to the ToolRegistry for agent use.
 *
 * Uses the same global-getter pattern as SpecTools for
 * runtime-dependent singleton instances set during activation().
 */

import { Tool } from './ToolRegistry';

/**
 * Get the active BrowserMirrorStream instance.
 * Auto-creates and opens the panel on first use if none exists yet.
 */
function getBrowserMirror(): any {
  const existing = (global as any).__FORGEAI_BROWSER_MIRROR__;
  if (existing && existing.dispose) return existing;

  try {
    // Dynamically import to avoid circular deps at module load
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BrowserMirrorStream } = require('../spec/BrowserMirrorStream');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ForgeBrowserSession } = require('../services/ForgeBrowserSession');
    const session = new ForgeBrowserSession();
    const mirror = new BrowserMirrorStream(
      {} as any,
      (global as any).__FORGEAI_WORKSPACE__?.workspaceRoot || process.cwd(),
      session
    );
    (global as any).__FORGEAI_BROWSER_MIRROR__ = mirror;
    void mirror.open('about:blank');
    return mirror;
  } catch {
    return null;
  }
}

/**
 * Get the active MobileMirror instance (set by extension.ts activation).
 */
function getMobileMirror(): any {
  return (global as any).__FORGEAI_MOBILE_MIRROR__;
}

export class BrowserAndVisualTools {
  /** forgeai_browserNavigate — Navigate the Browser Mirror to a URL */
  browserNavigate(): Tool {
    return {
      name: 'forgeai_browserNavigate',
      description: 'Navigate the Browser Mirror to a URL.',
      inputSchema: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', description: 'URL to navigate to' },
        },
      },
      execute: async (args: { url: string }) => {
        const mirror = getBrowserMirror();
        if (!mirror || typeof mirror.navigate !== 'function') {
          return { success: false, error: 'Browser Mirror is not available. Open the Browser Mirror panel first.' };
        }
        await mirror.navigate(args.url);
        return { success: true, url: args.url };
      },
    };
  }

  /** forgeai_browserExtract — Extract text/semantics from the current Browser Mirror page */
  browserExtract(): Tool {
    return {
      name: 'forgeai_browserExtract',
      description: 'Extract semantic DOM data from the current Browser Mirror page.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const mirror = getBrowserMirror();
        if (!mirror || typeof mirror.extractSemantics !== 'function') {
          return { success: false, error: 'Browser Mirror is not available. Open the Browser Mirror panel first.' };
        }
        const data = await mirror.extractSemantics();
        return { success: true, data };
      },
    };
  }

  /** forgeai_browserScreenshot — Capture a screenshot from the Browser Mirror */
  browserScreenshot(): Tool {
    return {
      name: 'forgeai_browserScreenshot',
      description: 'Capture a screenshot from the Browser Mirror.',
      inputSchema: {
        type: 'object',
        properties: {
          fullPage: { type: 'boolean', description: 'Capture full page (default: false)' },
        },
      },
      execute: async (args: { fullPage?: boolean } = {}) => {
        const mirror = getBrowserMirror();
        if (!mirror || typeof mirror.takeScreenshot !== 'function') {
          return { success: false, error: 'Browser Mirror is not available. Open the Browser Mirror panel first.' };
        }
        const result = await mirror.takeScreenshot(args.fullPage ?? false);
        return { success: true, screenshot: result };
      },
    };
  }

  /** forgeai_browserClick — Click an element in the Browser Mirror */
  browserClick(): Tool {
    return {
      name: 'forgeai_browserClick',
      description: 'Click an element in the Browser Mirror by selector.',
      inputSchema: {
        type: 'object',
        required: ['selector'],
        properties: {
          selector: { type: 'string', description: 'CSS selector for the element to click' },
        },
      },
      execute: async (args: { selector: string }) => {
        const mirror = getBrowserMirror();
        if (!mirror || typeof mirror.click !== 'function') {
          return { success: false, error: 'Browser Mirror is not available. Open the Browser Mirror panel first.' };
        }
        await mirror.click(args.selector);
        return { success: true, selector: args.selector };
      },
    };
  }

  /** forgeai_browserFill — Fill an input field in the Browser Mirror */
  browserFill(): Tool {
    return {
      name: 'forgeai_browserFill',
      description: 'Fill an input field in the Browser Mirror by selector.',
      inputSchema: {
        type: 'object',
        required: ['selector', 'value'],
        properties: {
          selector: { type: 'string', description: 'CSS selector for the input field' },
          value: { type: 'string', description: 'Value to fill' },
        },
      },
      execute: async (args: { selector: string; value: string }) => {
        const mirror = getBrowserMirror();
        if (!mirror || typeof mirror.fill !== 'function') {
          return { success: false, error: 'Browser Mirror is not available. Open the Browser Mirror panel first.' };
        }
        await mirror.fill(args.selector, args.value);
        return { success: true, selector: args.selector };
      },
    };
  }

  /** forgeai_browserScroll — Scroll the Browser Mirror page */
  browserScroll(): Tool {
    return {
      name: 'forgeai_browserScroll',
      description: 'Scroll the Browser Mirror page.',
      inputSchema: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['down', 'up', 'top', 'bottom'] },
          selector: { type: 'string', description: 'Optional element selector to scroll within' },
        },
      },
      execute: async (args: { direction?: string; selector?: string }) => {
        const mirror = getBrowserMirror();
        if (!mirror || typeof mirror.scroll !== 'function') {
          return { success: false, error: 'Browser Mirror is not available. Open the Browser Mirror panel first.' };
        }
        await mirror.scroll(args.direction || 'down', args.selector);
        return { success: true, direction: args.direction || 'down' };
      },
    };
  }

  /** forgeai_browserClose — Close the Browser Mirror session */
  browserClose(): Tool {
    return {
      name: 'forgeai_browserClose',
      description: 'Close the Browser Mirror session.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const mirror = getBrowserMirror();
        if (!mirror || typeof mirror.dispose !== 'function') {
          return { success: false, error: 'Browser Mirror is not available.' };
        }
        await mirror.dispose();
        return { success: true };
      },
    };
  }

  /** uiux_analyzeScreenshot — Run visual QA on the Browser Mirror screenshot */
  analyzeScreenshot(): Tool {
    return {
      name: 'uiux_analyzeScreenshot',
      description: 'Analyze the current Browser Mirror screenshot for visual defects using vision AI.',
      inputSchema: {
        type: 'object',
        properties: {
          fullPage: { type: 'boolean', description: 'Analyze full page screenshot (default: false)' },
        },
      },
      execute: async (args: { fullPage?: boolean } = {}) => {
        const mirror = getBrowserMirror();
        // VisualQA can also be reached via MobileMirror
        const visualAgent =
          (mirror as any)?.getVisualQAAgent?.() ||
          getMobileMirror()?.getVisualQAAgent?.();

        if (!visualAgent || typeof visualAgent.analyzeScreenshot !== 'function') {
          // Fallback: try BrowserMirrorStream's built-in visual QA
          if (mirror && typeof mirror.runVisualQA === 'function') {
            const result = await mirror.runVisualQA();
            return { success: true, ...result };
          }
          return { success: false, error: 'Visual QA agent is not available. Ensure Browser Mirror has a visible page.' };
        }

        // Get screenshot then analyze
        let screenshot;
        if (mirror && typeof mirror.takeScreenshot === 'function') {
          screenshot = await mirror.takeScreenshot(args.fullPage ?? false);
        }
        const result = await visualAgent.analyzeScreenshot(screenshot || Buffer.from(''));
        return { success: true, ...result };
      },
    };
  }
}
