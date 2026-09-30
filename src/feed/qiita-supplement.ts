import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { create as createCache } from 'flat-cache';
import constants from '../common/constants';
import { isPublishableHttpUrl } from '../common/url-guard';
import { removeInvalidUnicode, textTruncate } from './common-util';
import type { CustomRssParserFeed } from './feed-crawler';
import { logger } from './logger';
import { parsePublicationDate } from './publication-metadata';
import { SourceRequestQueue } from './source-request';

/** 匿名APIの毎時60回制限に余裕を残し、1実行の補完量と時間を制限する。 */
export const qiitaSupplementConfig = {
  maxRequests: 45,
  maxPagesPerTag: 10,
  pageSize: 100,
  budgetMs: 120_000,
  refreshMs: 15 * 60_000,
};

interface Article {
  id: string;
  url: string;
  title: string;
  publishedAt: string;
  summary: string;
  tags: string[];
  creator: string;
}

/** QiitaのタグRSSだけを補完し、人気順・企業別など別の集合には適用しない。 */
export const qiitaTag = (url: string): string | undefined => {
  const match = /^https:\/\/qiita\.com\/tags\/([^/?#]+)\/feed$/.exec(url);
  if (!match) return undefined;
  try {
    const tag = decodeURIComponent(match[1]);
    return /^[\p{L}\p{N}_.+#-]+$/u.test(tag) ? tag : undefined;
  } catch {
    return undefined;
  }
};

/** APIと保存済み記事に共通の公開条件を適用する。 */
const validArticle = (value: unknown, tag: string, cutoff: string, now: string): value is Article => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Article;
  return (
    typeof item.id === 'string' &&
    /^[a-f0-9]{20}$/.test(item.id) &&
    typeof item.url === 'string' &&
    isPublishableHttpUrl(item.url) &&
    new URL(item.url).origin === 'https://qiita.com' &&
    new URL(item.url).pathname.endsWith(`/items/${item.id}`) &&
    typeof item.title === 'string' &&
    item.title.trim() !== '' &&
    removeInvalidUnicode(item.title) === item.title &&
    typeof item.summary === 'string' &&
    removeInvalidUnicode(item.summary) === item.summary &&
    typeof item.creator === 'string' &&
    removeInvalidUnicode(item.creator) === item.creator &&
    parsePublicationDate(item.publishedAt) === item.publishedAt &&
    item.publishedAt >= cutoff &&
    item.publishedAt <= now &&
    Array.isArray(item.tags) &&
    item.tags.every((name) => typeof name === 'string' && removeInvalidUnicode(name) === name) &&
    item.tags.some((name) => name.toLowerCase() === tag.toLowerCase())
  );
};

/** 公開APIの応答を小さな記事データへ変換し、本文全体は保存しない。 */
const apiArticle = (value: unknown): Article | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  if (
    item.private === true ||
    typeof item.id !== 'string' ||
    typeof item.url !== 'string' ||
    typeof item.title !== 'string'
  )
    return undefined;
  const date = parsePublicationDate(item.created_at);
  if (!date || !Array.isArray(item.tags)) return undefined;
  const document = load(typeof item.rendered_body === 'string' ? item.rendered_body : '');
  document('script,style').remove();
  const user = item.user && typeof item.user === 'object' ? (item.user as Record<string, unknown>) : {};
  return {
    id: item.id,
    url: item.url,
    title: removeInvalidUnicode(item.title),
    publishedAt: date,
    summary: textTruncate(removeInvalidUnicode(document.text()).replace(/\s+/g, ' ').trim(), 500),
    tags: item.tags.flatMap((value) =>
      value && typeof value === 'object' && 'name' in value && typeof value.name === 'string'
        ? [removeInvalidUnicode(value.name)]
        : [],
    ),
    creator: typeof user.id === 'string' ? removeInvalidUnicode(user.id) : '',
  };
};

/** 短いタグRSSをページ取得で補い、期間内に一度取得した記事を保持する。 */
export class QiitaSupplement {
  private requests = 0;
  private deadline = 0;
  private readonly queue = new SourceRequestQueue();

  public async enrich(feed: CustomRssParserFeed, sourceUrl: string): Promise<void> {
    const tag = qiitaTag(sourceUrl);
    if (!tag) return;
    if (!this.deadline) this.deadline = Date.now() + qiitaSupplementConfig.budgetMs;
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - constants.aggregateFeedDurationInHours * 3600_000).toISOString();
    const key = createHash('sha256').update(sourceUrl).digest('hex');
    const cache = createCache({ cacheId: `qiita-supplement-v1-${key}`, ttl: 14 * 86400_000 });
    const saved: unknown = cache.get('articles');
    const cacheValid = Array.isArray(saved) && saved.every((item) => validArticle(item, tag, '', now));
    if (saved !== undefined && !cacheValid) logger.warn('[qiita-supplement] invalid-cache', { sourceUrl });
    const articles = new Map<string, Article>();
    if (Array.isArray(saved))
      for (const item of saved) if (validArticle(item, tag, cutoff, now)) articles.set(item.id, item);
    const checkedAt = parsePublicationDate(cache.get('checkedAt'));
    let complete =
      cacheValid &&
      !!checkedAt &&
      checkedAt <= now &&
      Date.parse(now) - Date.parse(checkedAt) < qiitaSupplementConfig.refreshMs;
    if (!complete) {
      for (let page = 1; page <= qiitaSupplementConfig.maxPagesPerTag; page++) {
        if (this.requests >= qiitaSupplementConfig.maxRequests || Date.now() >= this.deadline) break;
        const url = new URL('https://qiita.com/api/v2/items');
        url.search = new URLSearchParams({
          query: `tag:${tag} created:>=${cutoff.slice(0, 10)}`,
          page: String(page),
          per_page: String(qiitaSupplementConfig.pageSize),
        }).toString();
        try {
          this.requests++;
          const result: unknown = JSON.parse(
            await this.queue.fetchText(url.href, { accept: 'application/json', deadline: this.deadline }),
          );
          if (!Array.isArray(result) || result.length > qiitaSupplementConfig.pageSize)
            throw new Error('Qiita APIの応答が不正です');
          for (const value of result) {
            const item = apiArticle(value);
            if (item && validArticle(item, tag, cutoff, now)) articles.set(item.id, item);
          }
          if (result.length < qiitaSupplementConfig.pageSize) {
            complete = true;
            break;
          }
        } catch {
          logger.warn('[qiita-supplement] request-failed', { sourceUrl, page });
          break;
        }
      }
      if (complete) cache.set('checkedAt', now);
      else logger.warn('[qiita-supplement] incomplete', { sourceUrl, retained: articles.size });
      cache.set('articles', [...articles.values()]);
      try {
        cache.save();
      } catch {
        logger.warn('[qiita-supplement] cache-save-failed', { sourceUrl });
      }
    }
    const existing = new Set(feed.items.map((item) => item.link));
    const existingIds = new Set(feed.items.map((item) => /\/items\/([a-f0-9]{20})$/.exec(item.link)?.[1]));
    let added = 0;
    for (const item of articles.values()) {
      if (existing.has(item.url) || existingIds.has(item.id)) continue;
      feed.items.push({
        title: item.title,
        link: item.url,
        guid: item.url,
        isoDate: item.publishedAt,
        pubDate: new Date(item.publishedAt).toUTCString(),
        summary: item.summary,
        contentSnippet: item.summary,
        categories: item.tags,
        creator: item.creator,
        blogTitle: feed.title,
        blogLink: feed.link,
        sectionId: feed.sectionId,
        sourceLanguage: 'unknown',
        sourceFeedUrl: sourceUrl,
      });
      added++;
    }
    logger.info('[qiita-supplement] collected', { sourceUrl, added, complete });
  }
}
