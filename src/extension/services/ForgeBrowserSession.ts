/**
 * ForgeBrowserSession
 * Orchestrates a programmatic Playwright browser session with real-time screencasting
 * and semantic introspection for AI agents.
 */

import { chromium, Page, Browser, BrowserContext } from 'playwright';
import * as vscode from 'vscode';

export interface BrowserFrameEvent {
  type: 'RENDER_FRAME';
  data: string; // base64 JPEG
}

export class ForgeBrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private cdpSession: any = null;

  /**
   * Initialize the browser session and start screencasting.
   * @param onFrame Callback to handle raw base64 frames from the browser.
   * @param startUrl Initial URL to navigate to.
   */
  public async initialize(onFrame: (frame: BrowserFrameEvent) => void, startUrl: string = 'about:blank') {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      });

      this.page = await this.context.newPage();

      // Attach to Chrome DevTools Protocol (CDP) for high-speed screencasting
      // @ts-ignore - newCDPSession is a private/internal API in some versions of Playwright
      this.cdpSession = await this.page.context().newCDPSession(this.page);

      // Handle screencast frames
      this.cdpSession.on('Page.screencastFrame', async (event: any) => {
        onFrame({
          type: 'RENDER_FRAME',
          data: event.data,
        });

        // Acknowledge the frame receipt to keep the stream flowing
        try {
          await this.cdpSession.send('Page.screencastFrameAck', { sessionId: event.sessionId });
        } catch (e) {
          // Ignore ack errors
        }
      });

      // Start the screencast
      await this.cdpSession.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 60,
        everyNthFrame: 1,
      });

      await this.page.goto(startUrl);
      return { success: true };
    } catch (error) {
      console.error('ForgeBrowserSession.initialize error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Perform a click action at specified coordinates or selector.
   */
  public async click(selectorOrX: string | number, y?: number): Promise<void> {
    if (!this.page) throw new Error('Browser session not initialized');

    if (typeof selectorOrX === 'string') {
      await this.page.locator(selectorOrX).click({ timeout: 5000 });
    } else {
      await this.page.mouse.click(selectorOrX, y ?? 0);
    }
  }

  /**
   * Fill an input field with text.
   */
  public async fill(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Browser session not initialized');
    await this.page.locator(selector).fill(value, { timeout: 5000 });
  }

  /**
   * Navigate to a new URL.
   */
  public async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser session not initialized');
    await this.page.goto(url);
  }

  /**
   * Get a semantic snapshot of the page (Accessibility Tree).
   * This provides the LLM with a structured textual map of the UI.
   */
  public async getSemanticSnapshot(): Promise<string> {
    if (!this.page) throw new Error('Browser session not initialized');

    // @ts-ignore - _accessibility is internal
    const snapshot = await this.page._accessibility.snapshot();
    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Take a full-page screenshot for visual verification.
   */
  public async takeScreenshot(): Promise<Buffer> {
    if (!this.page) throw new Error('Browser session not initialized');
    return await this.page.screenshot({ fullPage: true });
  }

  /**
   * Close the session and cleanup.
   */
  public async terminate(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.cdpSession = null;
    }
  }

  public getPage(): Page | null {
    return this.page;
  }
}
