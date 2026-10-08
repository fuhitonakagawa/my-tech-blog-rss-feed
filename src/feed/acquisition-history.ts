import { createHash } from 'node:crypto';
import { create as createCache } from 'flat-cache';
import constants from '../common/constants';
import { isPublishableHttpUrl } from '../common/url-guard';
import type { FeedLanguage } from '../resources/feed-language';
import { normalizeArticleUrl, removeInvalidUnicode } from './common-util';
import type { CustomRssParserFeed, CustomRssParserItem } from './feed-crawler';
import {
  boundedFeedText,
  feedItemIdentifier,
  isDeliverableIdentifier,
  normalizeFeedItemTags,
} from './feed-item-policy';
import { logger } from './logger';
import { parsePublicationDate } from './publication-metadata';

export interface AcquiredArticle {
  link: string;
  guid: string;
  title: string;
  isoDate: string;
  summary: string;
  creator: string;
  categories: string[];
}

interface AcquisitionSnapshot {
  sourceUrl: string;
  items: AcquiredArticle[];
}

/** 取得履歴にも、通知RSSと同じ識別子・公開URL・日時の条件を適用する。 */
export const isAcquiredArticle = (value: unknown): value is AcquiredArticle => {
  if (!value || typeof value !== 'object') return false;
  const item = value as AcquiredArticle;
  return (
    typeof item.link === 'string' &&
    isPublishableHttpUrl(item.link) &&
    typeof item.guid === 'string' &&
    isDeliverableIdentifier(item.guid) &&
    feedItemIdentifier(item.link, item.guid) === item.guid &&
    typeof item.title === 'string' &&
    item.title.length <= 2000 &&
    removeInvalidUnicode(item.title) === item.title &&
    parsePublicationDate(item.isoDate) === item.isoDate &&
    typeof item.summary === 'string' &&
    item.summary.length <= 5000 &&
    removeInvalidUnicode(item.summary) === item.summary &&
    typeof item.creator === 'string' &&
    item.creator.length <= 2000 &&
    removeInvalidUnicode(item.creator) === item.creator &&
    Array.isArray(item.categories) &&
    item.categories.every((tag) => typeof tag === 'string' && tag.length <= 2000 && removeInvalidUnicode(tag) === tag)
  );
};

/** URLの追跡情報を除き、記事を区別するフラグメントは保持する。 */
const articleKey = (link: string): string => {
  const url = new URL(normalizeArticleUrl(link));
  url.hash = new URL(link).hash;
  return url.href;
};

const snapshotArticle = (item: CustomRssParserItem): AcquiredArticle => ({
  link: item.link,
  guid: feedItemIdentifier(item.link, item.guid),
  title: boundedFeedText(item.title ?? '', 2000),
  isoDate: item.isoDate,
  summary: boundedFeedText(item.summary || item.contentSnippet || '', 5000),
  creator: boundedFeedText(item.creator ?? '', 2000),
  categories: normalizeFeedItemTags(item.categories),
});

/** 公開成功とは独立して取得済み記事を保持し、元RSSから消えた期間内記事を補う。 */
export class AcquisitionHistory {
  public enrich(
    feed: CustomRssParserFeed,
    sourceUrl: string,
    seeds: readonly AcquiredArticle[] = [],
    language: FeedLanguage = feed.items[0]?.sourceLanguage ?? 'unknown',
  ): number {
    const key = createHash('sha256').update(sourceUrl).digest('hex');
    const cache = createCache({ cacheId: `feed-acquisition-v1-${key}`, ttl: 14 * 86400_000 });
    const saved: unknown = cache.get('snapshot');
    const previous = saved as AcquisitionSnapshot | undefined;
    const valid =
      previous &&
      previous.sourceUrl === sourceUrl &&
      Array.isArray(previous.items) &&
      previous.items.every(isAcquiredArticle);
    if (saved !== undefined && !valid) logger.warn('[feed-acquisition] invalid-cache', { sourceUrl });
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - constants.aggregateFeedDurationInHours * 3600_000).toISOString();
    const articles = new Map<string, AcquiredArticle>();
    for (const item of [...(valid ? previous.items : []), ...seeds, ...feed.items.map(snapshotArticle)]) {
      if (isAcquiredArticle(item) && item.isoDate >= cutoff && item.isoDate <= now)
        articles.set(articleKey(item.link), item);
    }
    cache.set('snapshot', { sourceUrl, items: [...articles.values()] } satisfies AcquisitionSnapshot);
    // 取得直後に保存し、後続の翻訳・通知履歴保存・公開失敗でも取得記録を残す。
    try {
      cache.save();
    } catch {
      logger.warn('[feed-acquisition] cache-save-failed', { sourceUrl });
    }
    const current = new Set(feed.items.map((item) => articleKey(item.link)));
    let added = 0;
    for (const [key, item] of articles) {
      if (current.has(key)) continue;
      feed.items.push({
        ...item,
        contentSnippet: item.summary,
        pubDate: new Date(item.isoDate).toUTCString(),
        blogTitle: feed.title,
        blogLink: feed.link,
        sectionId: feed.sectionId,
        sourceLanguage: language,
        sourceFeedUrl: sourceUrl,
      });
      added++;
    }
    if (added) logger.info('[feed-acquisition] restored', { sourceUrl, added });
    return added;
  }
}
