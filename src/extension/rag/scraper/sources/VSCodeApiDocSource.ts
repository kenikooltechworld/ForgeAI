import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class VSCodeApiDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'vscode-api';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      {
        title: 'VS Code API - Extension Anatomy',
        url: 'https://code.visualstudio.com/api/get-started/extension-anatomy',
      },
      {
        title: 'VS Code API - Activation Events',
        url: 'https://code.visualstudio.com/api/references/activation-events',
      },
      {
        title: 'VS Code API - Commands',
        url: 'https://code.visualstudio.com/api/extension-guides/command',
      },
      {
        title: 'VS Code API - Webviews',
        url: 'https://code.visualstudio.com/api/extension-guides/webview',
      },
      {
        title: 'VS Code API - Language Extensions',
        url: 'https://code.visualstudio.com/api/language-extensions/overview',
      },
      {
        title: 'VS Code API - Storage',
        url: 'https://code.visualstudio.com/api/extension-capabilities/common-capabilities',
      },
      {
        title: 'VS Code API - Workspace',
        url: 'https://code.visualstudio.com/api/references/vscode-api#workspace',
      },
      {
        title: 'VS Code API - Window',
        url: 'https://code.visualstudio.com/api/references/vscode-api#window',
      },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://code.visualstudio.com/api/get-started/extension-anatomy'],
      urlFilter: (url) => url.startsWith('https://code.visualstudio.com/api/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
