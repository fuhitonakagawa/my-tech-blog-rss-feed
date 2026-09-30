import { createHash } from 'node:crypto';
import { create as createCache } from 'flat-cache';
import RssParser from 'rss-parser';
import constants from '../common/constants';
import type { CustomRssParserFeed, CustomRssParserItem } from './feed-crawler';
import { logger } from './logger';
import { parseRemoteFeed } from './remote-feed-input';
import type { SourceRequestQueue } from './source-request';

type ActivityItem = CustomRssParserItem & { sourceUpdatedAt?: string };

/** 企業フィードの後続ページも読み、先頭数件から押し出された新着を保持する。 */
export class QiitaOrganizationSupplement {
  private deadline = 0;
  private readonly parser = new RssParser<object, ActivityItem>({
    customFields: { item: [['updated', 'sourceUpdatedAt']] },
  });

  constructor(private readonly queue: SourceRequestQueue) {}

  public async enrich(feed: CustomRssParserFeed, sourceUrl: string): Promise<void> {
    if (!/^https:\/\/qiita\.com\/organizations\/[^/?#]+\/activities\.atom$/.test(sourceUrl)) return;
    if (!this.deadline) this.deadline = Date.now() + 120_000;
    const cutoff = Date.now() - constants.aggregateFeedDurationInHours * 3600_000;
    const seen = new Set(feed.items.map((item) => item.link));
    let added = 0;
    for (let page = 2; page <= 20; page++) {
      if (Date.now() >= this.deadline) break;
      const url = `${sourceUrl}?page=${page}`;
      try {
        const key = createHash('sha256').update(url).digest('hex');
        const cache = createCache({ cacheId: `qiita-organization-v1-${key}`, ttl: 15 * 60_000 });
        const cached: unknown = cache.get('xml');
        let result: Awaited<ReturnType<typeof parseRemoteFeed<object, ActivityItem>>>;
        try {
          if (typeof cached !== 'string') throw new Error('キャッシュなし');
          result = await parseRemoteFeed(cached, this.parser, 'Qiita Organization');
        } catch {
          const xml = await this.queue.fetchText(url, { deadline: this.deadline });
          result = await parseRemoteFeed(xml, this.parser, 'Qiita Organization');
          cache.set('xml', result.xml);
          try {
            cache.save();
          } catch {
            logger.warn('[qiita-organization] cache-save-failed', { sourceUrl, page });
          }
        }
        const items = result.feed.items;
        if (!items.length) return;
        const unseen = items.filter((item) => item.link && !seen.has(item.link));
        if (!unseen.length) return;
        for (const item of unseen) {
          feed.items.push(item);
          seen.add(item.link);
          added++;
        }
        if (
          items.every((item) => {
            const dates = [Date.parse(item.isoDate), Date.parse(item.sourceUpdatedAt ?? '')].filter(Number.isFinite);
            return dates.length > 0 && Math.max(...dates) < cutoff;
          })
        )
          return;
      } catch {
        logger.warn('[qiita-organization] request-failed', { sourceUrl, page });
        break;
      }
    }
    logger.warn('[qiita-organization] incomplete', { sourceUrl, added });
  }
}
