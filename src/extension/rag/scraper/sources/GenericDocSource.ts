import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export interface GenericDocSourceConfig {
  sourceId: string;
  urls: Array<{ url: string; title?: string }>;
  crawlConfig?: CrawlConfig;
}

export class GenericDocSource implements DocSource {
  public readonly sourceId: DocSourceId;
  private readonly urls: Array<{ url: string; title?: string }>;

  constructor(config: GenericDocSourceConfig) {
    this.sourceId = config.sourceId as DocSourceId;
    this.urls = config.urls;
    if (config.crawlConfig) {
      (this as DocSource).getCrawlConfig = () => config.crawlConfig!;
    }
  }

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve(this.urls);
  }
}
