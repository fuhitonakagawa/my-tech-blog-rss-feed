import { createHash } from 'node:crypto';
import { isPublishableHttpUrl } from '../../common/url-guard';
import type { FeedInfo, FeedSection } from '../../resources/feed-info-list';
import { normalizeArticleUrl } from '../common-util';
import type { CustomRssParserItem } from '../feed-crawler';
import { isIsoDate, jstDay } from './dates';
import type { ArticleObservation } from './types';

export type StatisticsSection = Pick<FeedSection, 'id' | 'title'> & {
  kind?: 'source' | 'deduplicated';
  sourceSectionIds?: readonly string[];
  feedInfoList?: readonly (Pick<FeedInfo, 'url'> & Partial<Pick<FeedInfo, 'label' | 'language' | 'input'>>)[];
};

/** 公開履歴にはURLそのものを含めず、照合用ハッシュを保存する。 */
const hashIdentity = (value: string): string => createHash('sha256').update(value).digest('hex');

/** RSSの表記を正規化した取得元識別子。 */
export const statisticsSourceId = (url: string): string => hashIdentity(new URL(url).href);

/** 取得元が判明している記事は、カテゴリ移動前後で同じキーになる。 */
export const observationKey = (item: ArticleObservation): string =>
  `${item.sourceId ? `source:${item.sourceId}` : `section:${item.sectionId}`}:${item.articleId}`;

/** 元カテゴリの有効な記事だけを取得記録へ変換する。 */
const observeArticle = (
  item: CustomRssParserItem,
  titles: ReadonlyMap<string, string>,
  now: string,
): ArticleObservation | null => {
  const title = titles.get(item.sectionId);
  if (!title || !isIsoDate(item.isoDate) || item.isoDate > now || typeof item.link !== 'string') return null;
  const url = normalizeArticleUrl(item.link);
  if (!isPublishableHttpUrl(url)) return null;
  if (item.sourceFeedUrl !== undefined && !isPublishableHttpUrl(item.sourceFeedUrl)) return null;
  return {
    articleId: hashIdentity(url),
    sourceId: item.sourceFeedUrl ? statisticsSourceId(item.sourceFeedUrl) : null,
    inTranslatedFeed: false,
    sectionId: item.sectionId,
    sectionTitle: title,
    publishedAt: item.isoDate,
  };
};

/** 同じ取得元の記事が重なる場合は、最初の公開日時を保持する。 */
const keepEarliest = (records: Map<string, ArticleObservation>, item: ArticleObservation): void => {
  const key = observationKey(item);
  const saved = records.get(key);
  records.set(key, {
    ...(saved && saved.publishedAt <= item.publishedAt ? saved : item),
    inTranslatedFeed: item.inTranslatedFeed || saved?.inTranslatedFeed === true,
  });
};

/** 取得元が不明な保存履歴を、記事IDが一致する取得元へ結び付ける。 */
const resolveUnattributed = (records: Map<string, ArticleObservation>): void => {
  const byArticle = new Map<string, ArticleObservation[]>();
  for (const item of records.values()) {
    if (item.sourceId) byArticle.set(item.articleId, [...(byArticle.get(item.articleId) ?? []), item]);
  }
  for (const [key, item] of records) {
    if (item.sourceId) continue;
    const matches = byArticle.get(item.articleId);
    if (!matches) continue;
    const sameSection = matches.filter((candidate) => candidate.sectionId === item.sectionId);
    for (const candidate of sameSection.length ? sameSection : matches) {
      keepEarliest(records, { ...candidate, publishedAt: item.publishedAt });
    }
    records.delete(key);
  }
};

/** RSSの現在の所属で履歴を再分類し、再取得できない記事も保持する。 */
export const mergeObservations = (
  previous: readonly ArticleObservation[],
  items: readonly CustomRssParserItem[],
  sections: readonly StatisticsSection[],
  cutoff: string,
  now: string,
  translatedItems: readonly CustomRssParserItem[] = [],
): ArticleObservation[] => {
  const titles = new Map(sections.map((section) => [section.id, section.title]));
  const sources = new Map(
    sections.flatMap((section) =>
      (section.feedInfoList ?? []).map((feed) => [statisticsSourceId(feed.url), section] as const),
    ),
  );
  const records = new Map<string, ArticleObservation>();
  for (const item of previous) {
    const section = item.sourceId ? sources.get(item.sourceId) : undefined;
    keepEarliest(records, {
      ...item,
      sectionId: section?.id ?? item.sectionId,
      sectionTitle: section?.title ?? titles.get(item.sectionId) ?? item.sectionTitle,
    });
  }
  const savedKeys = new Set(records.keys());
  const savedDates = new Map<string, string>();
  for (const item of records.values()) {
    const key = `${item.sectionId}:${item.articleId}`;
    const date = savedDates.get(key);
    if (!date || item.publishedAt < date) savedDates.set(key, item.publishedAt);
  }
  for (const item of items) {
    const observed = observeArticle(item, titles, now);
    if (!observed || savedKeys.has(observationKey(observed))) continue;
    const publishedAt = savedDates.get(`${observed.sectionId}:${observed.articleId}`) ?? observed.publishedAt;
    keepEarliest(records, { ...observed, publishedAt });
  }
  for (const item of translatedItems) {
    const observed = observeArticle(item, titles, now);
    if (!observed) continue;
    const saved = records.get(observationKey(observed));
    if (saved) records.set(observationKey(saved), { ...saved, inTranslatedFeed: true });
  }
  resolveUnattributed(records);
  return [...records.values()]
    .filter((item) => jstDay(item.publishedAt) >= cutoff)
    .sort(
      (a, b) =>
        a.publishedAt.localeCompare(b.publishedAt) ||
        a.sectionId.localeCompare(b.sectionId) ||
        observationKey(a).localeCompare(observationKey(b)),
    );
};
