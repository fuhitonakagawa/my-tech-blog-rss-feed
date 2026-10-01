import { load } from 'cheerio';
import { removeInvalidUnicode } from '../common-util';
import { parsePublicationDate } from '../publication-metadata';
import type { GeneratedFeedDefinition, GeneratedFeedItem } from './types';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const text = (value: unknown): string =>
  typeof value === 'string' ? removeInvalidUnicode(load(value).text()).replace(/\s+/g, ' ').trim() : '';

/** 公開済みの記事だけを扱い、公開日の日付境界は中国標準時とする。 */
const article = (value: unknown, origin: string): GeneratedFeedItem | null => {
  if (!record(value) || value.publishStatus !== 'PUBLISH' || value.isDelete !== 'ACTIVE') return null;
  if (typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0) return null;
  const title = text(value.title);
  if (!title || typeof value.publishTime !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.publishTime)) return null;
  const publishedAt = parsePublicationDate(`${value.publishTime}T00:00:00+08:00`);
  if (!publishedAt) return null;
  const url = `${origin}/news/${value.id}`;
  return {
    id: url,
    url,
    title,
    publishedAt,
    summary: text(value.description),
    creator: text(value.author),
    categories: Array.isArray(value.tags)
      ? value.tags.flatMap((tag) => (record(tag) && text(tag.name) ? [text(tag.name)] : []))
      : [],
  };
};

/** 公式記事一覧の埋め込みデータを読み、表示用の作成・更新時刻を公開日に代用しない。 */
export const extractLeaderobot = (definition: GeneratedFeedDefinition, html: string): GeneratedFeedItem[] => {
  const $ = load(html);
  const data: unknown = JSON.parse($('#__NEXT_DATA__').text());
  const props = record(data) && data.props;
  const page = record(props) && props.pageProps;
  const fallback = record(page) && page.fallback;
  if (!record(fallback)) throw new Error('机器人大讲堂の記事一覧データがありません');
  const items = new Map<string, GeneratedFeedItem>();
  for (const [key, value] of Object.entries(fallback)) {
    if (!key.includes('"newsList"') || !record(value) || !Array.isArray(value.items)) continue;
    for (const entry of value.items) {
      const item = article(entry, new URL(definition.pageUrl).origin);
      if (item) items.set(item.id, item);
    }
  }
  if (!items.size) throw new Error('机器人大讲堂の公開記事を取得できません');
  return [...items.values()];
};
