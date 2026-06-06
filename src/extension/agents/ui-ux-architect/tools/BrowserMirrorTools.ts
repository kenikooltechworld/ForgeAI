/**
 * BrowserMirrorTools
 * Provides tools for AI agents to interact with and inspect the live browser mirror.
 */

import { Tool } from '../../../tools/ToolRegistry';
import { ForgeBrowserSession } from '../../../services/ForgeBrowserSession';

export class BrowserMirrorTools {
  constructor(private readonly session: ForgeBrowserSession) {}

  public clickElement(): Tool {
    return {
      name: 'browser_click',
      description: 'Click an element on the page using a CSS selector or coordinates.',
      inputSchema: {
        type: 'object',
        required: ['selectorOrX'],
        properties: {
          selectorOrX: {
            type: 'string',
            description: 'CSS selector for the element to click, or the X coordinate.',
          },
          y: {
            type: 'number',
            description: 'The Y coordinate (required if selectorOrX is a number).',
          },
        },
      },
      execute: async ({ selectorOrX, y }: { selectorOrX: string | number; y?: number }) => {
        try {
          if (typeof selectorOrX === 'number' && y !== undefined) {
            await this.session.click(selectorOrX, y);
          } else {
            await this.session.click(String(selectorOrX));
          }
          return { success: true, response: `Successfully clicked ${selectorOrX}` };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    };
  }

  public fillInput(): Tool {
    return {
      name: 'browser_fill',
      description: 'Fill an input field on the page with specific text.',
      inputSchema: {
        type: 'object',
        required: ['selector', 'value'],
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the input field.',
          },
          value: {
            type: 'string',
            description: 'The text to fill into the field.',
          },
        },
      },
      execute: async ({ selector, value }: { selector: string; value: string }) => {
        try {
          await this.session.fill(String(selector), String(value));
          return { success: true, response: `Successfully filled ${selector} with value.` };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    };
  }

  public navigateTo(): Tool {
    return {
      name: 'browser_navigate',
      description: 'Navigate the browser to a new URL.',
      inputSchema: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to.',
          },
        },
      },
      execute: async ({ url }: { url: string }) => {
        try {
          await this.session.navigate(String(url));
          return { success: true, response: `Navigated to ${url}` };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    };
  }

  /**
   * Tool to get the current semantic snapshot (Accessibility Tree) of the page.
   */
  public getSemanticSnapshot(): Tool {
    return {
      name: 'browser_get_semantics',
      description: 'Get a structured textual map (Accessibility Tree) of the current page. Use this to understand the UI structure before interacting.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        try {
          const snapshot = await this.session.getSemanticSnapshot();
          return { success: true, response: snapshot };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    };
  }

  /**
   * Tool to take a visual screenshot for high-fidelity verification.
   */
  public takeScreenshot(): Tool {
    return {
      name: 'browser_screenshot',
      description: 'Take a full-page screenshot for visual verification. Use this when structural checks pass but you need to verify layout/styling.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        try {
          await this.session.takeScreenshot();
          return { success: true, response: 'Screenshot captured and available for visual analysis.' };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    };
  }

  /**
   * Get all browser mirror tools.
   */
  public getAllTools(): Tool[] {
    return [
      this.clickElement(),
      this.fillInput(),
      this.navigateTo(),
      this.getSemanticSnapshot(),
      this.takeScreenshot(),
    ];
  }
}
