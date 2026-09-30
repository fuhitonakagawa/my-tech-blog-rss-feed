import { load } from 'cheerio';
import { isPublishableHttpUrl } from '../../common/url-guard';
import { removeInvalidUnicode } from '../common-util';
import { parsePublicationDate } from '../publication-metadata';
import type { GeneratedFeedDefinition, GeneratedFeedItem } from './types';

const text = (value: unknown): string =>
  typeof value === 'string' ? removeInvalidUnicode(load(value).text()).trim() : '';

/** 公開HTMLのブログ一覧データから、記事URLと公開日を保持して抽出する。 */
export const extractMongoDbBlog = (definition: GeneratedFeedDefinition, html: string): GeneratedFeedItem[] => {
  const $ = load(html);
  const items = new Map<string, GeneratedFeedItem>();
  $('script[type="text/template"]').each((_, element) => {
    let value: unknown;
    try {
      value = JSON.parse(load($(element).text()).text());
    } catch {
      return;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const data = value as Record<string, unknown>;
    const entries = [data.posts, data.contentstack].flatMap((list) => (Array.isArray(list) ? list : []));
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      if (record.status !== undefined && record.status !== 'published') continue;
      if (
        typeof record.url !== 'string' ||
        removeInvalidUnicode(record.url) !== record.url ||
        record.url.includes('\uFFFD')
      )
        continue;
      const publishedAt = parsePublicationDate(record.published_at);
      const title = text(record.title);
      if (!publishedAt || !title) continue;
      try {
        const url = new URL(record.url, `${new URL(definition.pageUrl).origin}/`);
        if (
          url.origin !== new URL(definition.pageUrl).origin ||
          !url.pathname.startsWith('/company/blog/') ||
          !isPublishableHttpUrl(url.href)
        )
          continue;
        items.set(url.href, {
          id: url.href,
          url: url.href,
          title,
          publishedAt,
          summary: text(record.summary),
          creator: '',
          categories: Array.isArray(record.channelTags) ? record.channelTags.map(text).filter(Boolean) : [],
        });
      } catch {
        /* URL不正の記事だけを除外する。 */
      }
    }
  });
  if (!items.size) throw new Error('MongoDBブログの公開記事を取得できません');
  return [...items.values()];
};
