import { createHash } from 'node:crypto';
import { isPublishableHttpUrl } from '../../common/url-guard';
import type { FeedSection } from '../../resources/feed-info-list';
import { normalizeArticleUrl } from '../common-util';
import type { CustomRssParserItem } from '../feed-crawler';
import { statisticsConfig } from './config';
import { dayStart, isIsoDate, jstDay, shiftDay } from './dates';
import type { ArticleObservation, CategoryCount, DailyReport, StatisticsState } from './types';

type StatisticsSection = Pick<FeedSection, 'id' | 'title'>;

/** 元カテゴリの有効な記事だけを取得記録へ変換する。 */
const observeArticle = (
  item: CustomRssParserItem,
  sections: ReadonlyMap<string, string>,
  now: string,
): ArticleObservation | null => {
  const title = sections.get(item.sectionId);
  if (!title || !isIsoDate(item.isoDate) || item.isoDate > now || typeof item.link !== 'string') return null;
  const articleUrl = normalizeArticleUrl(item.link);
  if (!isPublishableHttpUrl(articleUrl)) return null;
  return {
    articleId: createHash('sha256').update(articleUrl).digest('hex'),
    sectionId: item.sectionId,
    sectionTitle: title,
    publishedAt: item.isoDate,
  };
};

/** 同じカテゴリ・記事の公開日時を保持し、表示名は現在の定義を使う。 */
const mergeObservations = (
  previous: readonly ArticleObservation[],
  items: readonly CustomRssParserItem[],
  sections: readonly StatisticsSection[],
  cutoff: string,
  now: string,
): ArticleObservation[] => {
  const sectionTitles = new Map(sections.map((section) => [section.id, section.title]));
  const byArticle = new Map(
    previous.map((item) => [
      `${item.sectionId}:${item.articleId}`,
      { ...item, sectionTitle: sectionTitles.get(item.sectionId) ?? item.sectionTitle },
    ]),
  );
  const savedKeys = new Set(byArticle.keys());
  for (const item of items) {
    const observation = observeArticle(item, sectionTitles, now);
    if (!observation) continue;
    const key = `${observation.sectionId}:${observation.articleId}`;
    const existing = byArticle.get(key);
    if (!savedKeys.has(key) && (!existing || observation.publishedAt < existing.publishedAt))
      byArticle.set(key, observation);
  }
  return [...byArticle.values()]
    .filter((item) => jstDay(item.publishedAt) >= cutoff)
    .sort(
      (a, b) =>
        a.publishedAt.localeCompare(b.publishedAt) ||
        a.sectionId.localeCompare(b.sectionId) ||
        a.articleId.localeCompare(b.articleId),
    );
};

/** 日付ごとにカテゴリ内の重複を除いた件数を返す。 */
const countByDay = (observations: readonly ArticleObservation[]): Map<string, CategoryCount[]> => {
  const days = new Map<string, Map<string, CategoryCount>>();
  for (const item of observations) {
    const date = jstDay(item.publishedAt);
    const categories = days.get(date) ?? new Map<string, CategoryCount>();
    const category = categories.get(item.sectionId) ?? {
      sectionId: item.sectionId,
      title: item.sectionTitle,
      count: 0,
    };
    category.count++;
    categories.set(item.sectionId, category);
    days.set(date, categories);
  }
  return new Map(
    [...days].map(([date, categories]) => [
      date,
      [...categories.values()].sort((a, b) => b.count - a.count || a.sectionId.localeCompare(b.sectionId)),
    ]),
  );
};

/** 終了した日だけを集計し、同じ内容の更新日時を維持する。 */
const buildReports = (state: StatisticsState, firstDay: string, today: string): DailyReport[] => {
  const counts = countByDay(state.observations);
  const previous = new Map(state.reports.map((report) => [report.date, report]));
  const collectedDays = new Set(state.collectionDays);
  const reports: DailyReport[] = [];
  for (let date = firstDay; date < today; date = shiftDay(date, 1)) {
    const coverage = !collectedDays.has(date)
      ? 'unobserved'
      : date === jstDay(state.startedAt) && state.startedAt !== dayStart(date)
        ? 'partial'
        : 'observed';
    const categories = counts.get(date) ?? [];
    const old = previous.get(date);
    reports.push({
      date,
      publishedAt: dayStart(shiftDay(date, 1)),
      updatedAt:
        old && old.coverage === coverage && JSON.stringify(old.categories) === JSON.stringify(categories)
          ? old.updatedAt
          : state.lastCollectedAt,
      coverage,
      categories,
    });
  }
  return reports.reverse();
};

/** 取得履歴を蓄積し、前日までの日次統計を補完する。 */
export const updateStatistics = (
  previous: StatisticsState | null,
  items: readonly CustomRssParserItem[],
  sections: readonly StatisticsSection[],
  currentDate: Date,
): StatisticsState => {
  const now = currentDate.toISOString();
  if (previous && now < previous.lastCollectedAt) throw new Error('保存済み履歴より前の時刻では集計できません');
  const today = jstDay(now);
  const startedAt = previous?.startedAt ?? now;
  const startedDay = jstDay(startedAt);
  const cutoffDay = shiftDay(today, -statisticsConfig.retentionDays);
  const firstDay = startedDay > cutoffDay ? startedDay : cutoffDay;
  const state: StatisticsState = {
    schemaVersion: 1,
    startedAt,
    lastCollectedAt: now,
    collectionDays: [...new Set([...(previous?.collectionDays ?? []), today])].filter((day) => day >= firstDay).sort(),
    observations: mergeObservations(previous?.observations ?? [], items, sections, firstDay, now),
    reports: previous?.reports ?? [],
  };
  state.reports = buildReports(state, firstDay, today);
  return state;
};
