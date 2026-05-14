import * as vscode from 'vscode';
import { Tool } from './ToolRegistry';

/**
 * Browser Tools - Enables the AI agent to browse the web for research
 *
 * Uses Playwright for browser automation. All operations run locally.
 * Designed for autonomous navigation, interaction, and data extraction.
 */

export class BrowserTools {
  private browser: any = null;
  private context: any = null;
  private page: any = null;
  private lastActivity: number = 0;
  private idleTimeoutId: NodeJS.Timeout | null = null;
  private readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Lazy initialization - browser starts on first use
   */
  private async ensureBrowser() {
    if (this.browser && this.context && this.page) {
      this.lastActivity = Date.now();
      return this.page;
    }

    // Import playwright dynamically to avoid startup cost
    const { chromium } = await import('playwright');

    const config = vscode.workspace.getConfiguration('forgeai');
    const headless = config.get<boolean>('browser.headless', true);
    const browserType = config.get<string>('browser.type', 'chromium');

    try {
      this.browser = await chromium.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch (launchError: any) {
      // Detect missing browser executables
      if (
        launchError?.message?.includes("Executable doesn't exist") ||
        launchError?.message?.includes('npx playwright install')
      ) {
        // Log quietly — do NOT show UI popup during agent execution.
        // The agent will catch this error and can fall back to webSearch.
        console.warn(
          '[BrowserTools] Playwright browsers not installed. ' +
            'Run "npx playwright install chromium" to enable browser tools. ' +
            'Until then, use forgeai_webSearch for web research.'
        );
        throw new Error(
          'Browser automation unavailable — Playwright browsers are not installed. ' +
            'Use forgeai_webSearch or forgeai_webResearch for cloud-based web research instead. ' +
            'To enable browser tools, run: npx playwright install chromium'
        );
      }
      throw launchError;
    }

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'ForgeAI/1.0 (Research Bot)',
    });

    this.page = await this.context.newPage();
    this.lastActivity = Date.now();
    this.setupIdleMonitoring();

    return this.page;
  }

  private setupIdleMonitoring() {
    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
    }

    this.idleTimeoutId = setInterval(() => {
      if (Date.now() - this.lastActivity > this.IDLE_TIMEOUT_MS) {
        this.closeBrowser();
      }
    }, 30000); // Check every 30 seconds
  }

  private async closeBrowser() {
    if (this.idleTimeoutId) {
      clearInterval(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }

    if (this.page) {
      await this.page.close().catch(() => undefined);
      this.page = null;
    }

    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }

  // ─── Tool Definitions ────────────────────────────────────────────────────

  /**
   * Navigate to a URL and wait for page load
   */
  browserNavigate(): Tool {
    return {
      name: 'forgeai_browser_navigate',
      description:
        '[REQUIRES PLAYWRIGHT] Navigate to a URL using a local browser. ' +
        'ONLY use this if you need to interact with a page (click, fill forms, screenshots). ' +
        'For reading documentation or researching topics, prefer forgeai_webSearch or forgeai_webResearch ' +
        'which do NOT require a local browser.',
      inputSchema: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to (must be http:// or https://)',
          },
          waitForSelector: {
            type: 'string',
            description: 'Optional: Wait for a specific CSS selector to appear before returning',
          },
        },
      },
      execute: async (args: { url: string; waitForSelector?: string }) => {
        const page = await this.ensureBrowser();

        // Validate URL
        let url: URL;
        try {
          url = new URL(args.url);
        } catch {
          throw new Error(`Invalid URL: ${args.url}. Must be a valid http:// or https:// URL.`);
        }

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error(
            `Unsupported protocol: ${url.protocol}. Only http and https are allowed.`
          );
        }

        // Check for sensitive sites
        if (this.isSensitiveSite(url.hostname)) {
          const confirmed = await vscode.window.showWarningMessage(
            `The AI wants to navigate to ${url.hostname}. This appears to be a sensitive site. Proceed?`,
            { modal: true },
            'Yes',
            'No'
          );
          if (confirmed !== 'Yes') {
            throw new Error('User declined navigation to sensitive site');
          }
        }

        // Navigate with timeout
        const config = vscode.workspace.getConfiguration('forgeai');
        const timeout = config.get<number>('browser.pageLoadTimeout', 30) * 1000;

        const response = await page.goto(args.url, {
          waitUntil: 'networkidle',
          timeout,
        });

        // Optionally wait for selector
        if (args.waitForSelector) {
          await page.waitForSelector(args.waitForSelector, { timeout: 10000 });
        }

        const title = await page.title();
        const finalUrl = page.url();

        return {
          success: true,
          url: finalUrl,
          title,
          statusCode: response?.status() ?? null,
        };
      },
    };
  }

  /**
   * Extract content from the current page
   */
  browserExtract(): Tool {
    return {
      name: 'forgeai_browser_extract',
      description:
        '[REQUIRES PLAYWRIGHT] Extract text from the current browser page after navigation. ' +
        'For research that does not require clicking or screenshots, use forgeai_webSearch instead.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description:
              'Optional: CSS selector to extract specific element content (e.g., "main", "article", ".content")',
          },
          maxLength: {
            type: 'number',
            description: 'Optional: Maximum characters to return (default: 8000)',
          },
        },
      },
      execute: async (args: { selector?: string; maxLength?: number }) => {
        const page = await this.ensureBrowser();

        const maxLen = args.maxLength ?? 8000;

        let content: string;

        if (args.selector) {
          // Extract from specific element
          const element = await page.locator(args.selector).first();
          const exists = await element.count();
          if (exists === 0) {
            throw new Error(`Element not found: ${args.selector}`);
          }
          content = await element.innerText();
        } else {
          // Extract full page text (excluding nav/footer for cleaner results)
          content = await page.evaluate(() => {
            // Try to find main content area
            const selectors = [
              'main',
              'article',
              '[role="main"]',
              '.content',
              '#content',
              '.documentation',
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el) {
                return (el as HTMLElement).innerText || '';
              }
            }
            // Fallback: body text minus common noise elements
            const body = document.body.cloneNode(true) as HTMLElement;
            const noise = body.querySelectorAll(
              'nav, header, footer, aside, script, style, noscript'
            );
            noise.forEach((el) => el.remove());
            return body.innerText;
          });
        }

        // Truncate if too long
        const truncated = content.length > maxLen;
        const text =
          content.length > maxLen ? content.slice(0, maxLen) + '\n... [truncated]' : content;

        // Also extract links for context
        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll('a[href]'))
            .map((a) => ({
              text: (a as HTMLAnchorElement).innerText.slice(0, 100),
              href: (a as HTMLAnchorElement).href,
            }))
            .filter((l) => l.text && l.href.startsWith('http'))
            .slice(0, 20)
        );

        return {
          success: true,
          url: page.url(),
          title: await page.title(),
          content: text,
          truncated,
          originalLength: content.length,
          links,
        };
      },
    };
  }

  /**
   * Click an element on the current page
   */
  browserClick(): Tool {
    return {
      name: 'forgeai_browser_click',
      description:
        'Click an element on the current page by selector. Use this to navigate pagination, expand sections, or interact with the page after extraction.',
      inputSchema: {
        type: 'object',
        required: ['selector'],
        properties: {
          selector: {
            type: 'string',
            description:
              'CSS selector for the element to click (e.g., "a.next", "button[aria-label=\"Next\"]")',
          },
          waitForNavigation: {
            type: 'boolean',
            description: 'Wait for page navigation after click (default: true)',
          },
        },
      },
      execute: async (args: { selector: string; waitForNavigation?: boolean }) => {
        const page = await this.ensureBrowser();

        const locator = page.locator(args.selector).first();
        const exists = await locator.count();
        if (exists === 0) {
          // Try to find alternative selectors
          const alternatives = await this.findAlternativeSelectors(page, args.selector);
          throw new Error(
            `Element not found: ${args.selector}. ` +
              (alternatives.length > 0
                ? `Try alternatives: ${alternatives.map((a) => a.selector).join(', ')}`
                : '')
          );
        }

        const shouldWait = args.waitForNavigation !== false;

        if (shouldWait) {
          await Promise.race([
            locator.click(),
            page
              .waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 })
              .catch(() => undefined),
          ]);
        } else {
          await locator.click();
        }

        return {
          success: true,
          selector: args.selector,
          url: page.url(),
          title: await page.title(),
        };
      },
    };
  }

  /**
   * Take a screenshot of the current page
   */
  browserScreenshot(): Tool {
    return {
      name: 'forgeai_browser_screenshot',
      description:
        'Take a screenshot of the current browser page. Returns a base64-encoded PNG image. Use this when visual context of the page is needed.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description:
              'Optional: CSS selector of a specific element to screenshot instead of the full page',
          },
        },
      },
      execute: async (args: { selector?: string }) => {
        const page = await this.ensureBrowser();

        let screenshot: Buffer;
        if (args.selector) {
          const locator = page.locator(args.selector).first();
          screenshot = await locator.screenshot();
        } else {
          screenshot = await page.screenshot();
        }

        const base64 = screenshot.toString('base64');

        return {
          success: true,
          url: page.url(),
          title: await page.title(),
          imageBase64: base64,
          format: 'png',
        };
      },
    };
  }

  /**
   * Fill a form input field
   */
  browserFill(): Tool {
    return {
      name: 'forgeai_browser_fill',
      description:
        'Fill an input field on the current page. Use this to enter search queries, form data, or interact with input elements after navigation.',
      inputSchema: {
        type: 'object',
        required: ['selector', 'value'],
        properties: {
          selector: {
            type: 'string',
            description:
              'CSS selector for the input element (e.g., "input[name=\"q\"]", "#search")',
          },
          value: {
            type: 'string',
            description: 'Value to fill into the input field',
          },
          pressEnter: {
            type: 'boolean',
            description: 'Press Enter after filling (default: true for search inputs)',
          },
        },
      },
      execute: async (args: { selector: string; value: string; pressEnter?: boolean }) => {
        const page = await this.ensureBrowser();

        const locator = page.locator(args.selector).first();
        const exists = await locator.count();
        if (exists === 0) {
          throw new Error(`Input element not found: ${args.selector}`);
        }

        await locator.fill(args.value);

        const shouldPressEnter = args.pressEnter !== false;
        if (shouldPressEnter) {
          await locator.press('Enter');
        }

        return {
          success: true,
          selector: args.selector,
          value: args.value,
          url: page.url(),
          title: await page.title(),
        };
      },
    };
  }

  /**
   * Scroll the current page
   */
  browserScroll(): Tool {
    return {
      name: 'forgeai_browser_scroll',
      description:
        'Scroll the current page up or down. Use this to view more content on a long page after extraction.',
      inputSchema: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['up', 'down', 'top', 'bottom'],
            description: 'Direction to scroll',
          },
          amount: {
            type: 'number',
            description: 'Pixels to scroll (default: 800)',
          },
        },
      },
      execute: async (args: { direction: 'up' | 'down' | 'top' | 'bottom'; amount?: number }) => {
        const page = await this.ensureBrowser();
        const amount = args.amount ?? 800;

        switch (args.direction) {
          case 'up':
            await page.evaluate((y: number) => window.scrollBy(0, -y), amount);
            break;
          case 'down':
            await page.evaluate((y: number) => window.scrollBy(0, y), amount);
            break;
          case 'top':
            await page.evaluate(() => window.scrollTo(0, 0));
            break;
          case 'bottom':
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            break;
        }

        const scrollPosition = await page.evaluate(() => ({
          x: window.scrollX,
          y: window.scrollY,
          maxHeight: document.body.scrollHeight,
        }));

        return {
          success: true,
          direction: args.direction,
          scrollPosition,
          url: page.url(),
        };
      },
    };
  }

  /**
   * Close the browser and cleanup resources
   */
  browserClose(): Tool {
    return {
      name: 'forgeai_browser_close',
      description:
        'Close the browser session and free resources. Call this when research is complete.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        await this.closeBrowser();
        return { success: true, message: 'Browser session closed' };
      },
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private isSensitiveSite(hostname: string): boolean {
    const sensitivePatterns = [
      /\.(bank|paypal|stripe)\.com$/i,
      /(banking|secure|login|signin|auth)\.\w+$/i,
      /mail\.google\.com/i,
      /outlook\.live\.com/i,
      /online\.wellsfargo\.com/i,
      /chase\.com/i,
      /citibank\.com/i,
      /americanexpress\.com/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(hostname));
  }

  private async findAlternativeSelectors(
    page: any,
    failedSelector: string
  ): Promise<Array<{ type: string; selector: string }>> {
    const alternatives: Array<{ type: string; selector: string }> = [];

    // Try to infer from the selector what we're looking for
    const textMatch = failedSelector.match(/text=["']?([^"']+)["']?/i);
    if (textMatch) {
      alternatives.push({ type: 'text', selector: `:text("${textMatch[1]}")` });
    }

    // Try common role-based selectors
    if (failedSelector.includes('next') || failedSelector.includes(' pagination')) {
      alternatives.push({ type: 'role', selector: '[role="link"]:has-text("Next")' });
    }

    // Try by partial text
    const parts = failedSelector.split(/[.#\[\]="']/);
    for (const part of parts) {
      if (part.length > 3) {
        alternatives.push({ type: 'partial', selector: `:has-text("${part}")` });
        break;
      }
    }

    return alternatives.slice(0, 3);
  }
}
