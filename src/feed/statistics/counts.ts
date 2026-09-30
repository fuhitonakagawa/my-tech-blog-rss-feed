import { isPublishableHttpUrl } from '../../common/url-guard';
import type { TranslatedFeedDefinition } from '../../resources/translated-feed-list';
import { jstDay } from './dates';
import { type StatisticsSection, statisticsSourceId } from './observations';
import type { ArticleObservation, CategoryCount, SourceCount } from './types';

/** カテゴリ内の同じ記事には共通の計上日を使う。 */
export const observationsByDay = (observations: readonly ArticleObservation[]): Map<string, ArticleObservation[]> => {
  const dates = new Map<string, string>();
  for (const item of observations) {
    const key = `${item.sectionId}:${item.articleId}`;
    const saved = dates.get(key);
    if (!saved || item.publishedAt < saved) dates.set(key, item.publishedAt);
  }
  const days = new Map<string, ArticleObservation[]>();
  for (const item of observations) {
    const day = jstDay(dates.get(`${item.sectionId}:${item.articleId}`) ?? item.publishedAt);
    const items = days.get(day) ?? [];
    items.push(item);
    days.set(day, items);
  }
  return days;
};

const uniqueCount = (items: readonly ArticleObservation[]): number => new Set(items.map((item) => item.articleId)).size;

/** dedupに実際に載った記事と元カテゴリの所属を照合する。日付差によって所属を失わない。 */
const countDeduplicatedSources = (
  section: StatisticsSection,
  items: readonly ArticleObservation[],
  history: readonly ArticleObservation[],
  sections: ReadonlyMap<string, StatisticsSection>,
): NonNullable<CategoryCount['sourceCategories']> => {
  const published = new Set(items.map((item) => item.articleId));
  const attributed = new Set<string>();
  const counts = (section.sourceSectionIds ?? []).map((sectionId) => {
    const matches = history.filter((item) => item.sectionId === sectionId && published.has(item.articleId));
    for (const item of matches) attributed.add(item.articleId);
    return { sectionId, title: sections.get(sectionId)?.title ?? sectionId, count: uniqueCount(matches) };
  });
  const result: NonNullable<CategoryCount['sourceCategories']> = counts;
  if (attributed.size < published.size)
    result.push({ sectionId: null, title: '所属不明', count: published.size - attributed.size });
  return result.sort((a, b) => b.count - a.count || (a.sectionId ?? '').localeCompare(b.sectionId ?? ''));
};

/** URL別の内訳には同じRSS内の重複を除いた件数を表示する。 */
const countSources = (section: StatisticsSection, items: readonly ArticleObservation[]): SourceCount[] => {
  const known = new Set<string>();
  const feeds: SourceCount[] = [];
  for (const feed of section.feedInfoList ?? []) {
    if (!isPublishableHttpUrl(feed.url)) continue;
    const id = statisticsSourceId(feed.url);
    known.add(id);
    feeds.push({
      title: feed.label ?? feed.url,
      url: feed.url,
      kind: feed.input?.kind === 'generated' ? 'generated' : 'remote',
      count: uniqueCount(items.filter((item) => item.sourceId === id)),
    });
  }
  const unresolved = items.filter((item) => !item.sourceId || !known.has(item.sourceId));
  if (unresolved.length) {
    feeds.push({ title: '取得元を特定できない記事', url: null, kind: 'unresolved', count: uniqueCount(unresolved) });
  }
  return feeds.sort((a, b) => b.count - a.count || (a.url ?? '').localeCompare(b.url ?? ''));
};

/** 通常カテゴリと翻訳カテゴリを分けて、登録された全取得元を集計する。 */
export const countCategories = (
  observations: readonly ArticleObservation[],
  sections: readonly StatisticsSection[],
  translations: readonly TranslatedFeedDefinition[],
  history: readonly ArticleObservation[] = observations,
): CategoryCount[] => {
  const current = new Map(sections.map((section) => [section.id, section]));
  for (const item of observations) {
    if (!current.has(item.sectionId)) current.set(item.sectionId, { id: item.sectionId, title: item.sectionTitle });
  }
  const categories: CategoryCount[] = [];
  for (const section of current.values()) {
    const items = observations.filter((item) => item.sectionId === section.id);
    categories.push({
      sectionId: section.id,
      title: section.title,
      kind: section.kind ?? 'source',
      count: uniqueCount(items),
      feeds: countSources(section, items),
      ...(section.kind === 'deduplicated' && section.sourceSectionIds
        ? { sourceCategories: countDeduplicatedSources(section, items, history, current) }
        : {}),
    });
  }
  for (const definition of translations) {
    const section = current.get(definition.sourceSectionId);
    if (!section) continue;
    const englishSources = new Set(
      (section.feedInfoList ?? []).filter((feed) => feed.language === 'en').map((feed) => statisticsSourceId(feed.url)),
    );
    const original = categories.find((category) => category.sectionId === section.id);
    if (original)
      original.englishCount = uniqueCount(
        observations.filter(
          (item) => item.sectionId === section.id && item.sourceId !== null && englishSources.has(item.sourceId),
        ),
      );
    const excluded = new Set(
      (section.feedInfoList ?? []).filter((feed) => feed.language !== 'en').map((feed) => statisticsSourceId(feed.url)),
    );
    const items = observations.filter(
      (item) => item.sectionId === section.id && item.inTranslatedFeed && item.sourceId && !excluded.has(item.sourceId),
    );
    categories.push({
      sectionId: definition.id,
      title: definition.title,
      kind: 'translated',
      sourceSectionId: section.id,
      count: uniqueCount(items),
      feeds: countSources(
        { ...section, feedInfoList: section.feedInfoList?.filter((feed) => feed.language === 'en') },
        items,
      ),
    });
  }
  return categories.sort((a, b) => b.count - a.count || a.sectionId.localeCompare(b.sectionId));
};
