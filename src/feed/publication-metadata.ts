import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { create as flatCacheCreate } from 'flat-cache';
import constants from '../common/constants';
import { isPublishableHttpUrl, publicNetworkDispatcher } from '../common/url-guard';
import type { CustomRssParserFeed } from './feed-crawler';
import { logger } from './logger';

/** 日付のみはUTCの0時、時刻付きは明示されたタイムゾーンで解釈する。 */
export const parsePublicationDate = (value: unknown): string | undefined => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)
  )
    return undefined;
  const day = value.slice(0, 10);
  const calendar = new Date(`${day}T00:00:00.000Z`);
  const date = new Date(value);
  if (
    !Number.isFinite(calendar.getTime()) ||
    calendar.toISOString().slice(0, 10) !== day ||
    !Number.isFinite(date.getTime())
  )
    return undefined;
  return date.toISOString();
};

/** Articleの公開日のみを読み、更新日や一覧全体の日時は代用しない。 */
export const publicationDateFromHtml = (html: string): string | undefined => {
  const $ = load(html);
  const dates = new Set<string>();
  const add = (value: unknown): void => {
    const date = parsePublicationDate(value);
    if (date) dates.add(date);
  };
  $('meta[property="article:published_time"]').each((_, node) => {
    add($(node).attr('content'));
  });
  const inspect = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(inspect);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
    if (types.some((type) => ['Article', 'BlogPosting', 'TechArticle', 'NewsArticle'].includes(String(type))))
      add(record.datePublished);
    if (record['@graph']) inspect(record['@graph']);
  };
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      inspect(JSON.parse($(node).text()));
    } catch {
      /* 他の構造化データは独立して検査する。 */
    }
  });
  return dates.size === 1 ? [...dates][0] : undefined;
};

/** 明示指定された取得元だけ、同一サイトの記事メタデータから欠落日付を補う。 */
export const fillPublicationDates = async (feed: CustomRssParserFeed, sourceUrl: string): Promise<void> => {
  const cache = flatCacheCreate({ cacheId: 'article-publication-v1', ttl: 14 * 86400_000 });
  const deadline = Date.now() + 60_000;
  const missing = feed.items.filter(
    (item) =>
      !item.isoDate && isPublishableHttpUrl(item.link) && new URL(item.link).origin === new URL(sourceUrl).origin,
  );
  if (missing.length > 50) logger.warn('[feed-date] lookup-limit', { sourceUrl, count: missing.length });
  for (const item of missing.slice(0, 50)) {
    if (Date.now() >= deadline) {
      logger.warn('[feed-date] lookup-timeout', { sourceUrl });
      break;
    }
    const key = createHash('sha256').update(item.link, 'utf8').digest('hex');
    let date = parsePublicationDate(cache.get<string>(key));
    if (!date) {
      try {
        const response = await fetch(item.link, {
          headers: { 'user-agent': constants.requestUserAgent },
          signal: AbortSignal.timeout(Math.min(constants.externalFetchTimeoutMs, Math.max(1, deadline - Date.now()))),
          dispatcher: publicNetworkDispatcher,
        });
        if (
          !response.ok ||
          !response.headers.get('content-type')?.includes('text/html') ||
          new URL(response.url).origin !== new URL(sourceUrl).origin
        ) {
          await response.body?.cancel();
          throw new Error('記事を取得できません');
        }
        date = publicationDateFromHtml(await response.text());
        if (date) cache.set(key, date);
        else logger.warn('[feed-date] publication-date-missing', { sourceUrl });
      } catch {
        logger.warn('[feed-date] metadata-unavailable', { sourceUrl });
      }
    }
    if (date) {
      item.isoDate = date;
      item.pubDate = new Date(date).toUTCString();
    }
  }
  try {
    cache.save();
  } catch {
    logger.warn('[feed-date] cache-save-failed', { sourceUrl });
  }
};
