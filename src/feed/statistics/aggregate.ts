import type { CustomRssParserItem } from '../feed-crawler';
import { statisticsConfig } from './config';
import { dayStart, jstDay, shiftDay } from './dates';
import { type StatisticsSection, mergeObservations } from './observations';
import type { ArticleObservation, CategoryCount, DailyReport, StatisticsState } from './types';

/** 日付ごとにカテゴリ内の重複を除いた件数を返す。 */
const countByDay = (observations: readonly ArticleObservation[]): Map<string, CategoryCount[]> => {
  const days = new Map<string, Map<string, CategoryCount>>();
  const unique = new Map<string, ArticleObservation>();
  for (const item of observations) {
    const key = `${item.sectionId}:${item.articleId}`;
    const saved = unique.get(key);
    if (!saved || item.publishedAt < saved.publishedAt) unique.set(key, item);
  }
  for (const item of unique.values()) {
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
const buildReports = (
  state: StatisticsState,
  firstDay: string,
  today: string,
  sections: readonly StatisticsSection[],
): DailyReport[] => {
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
    const present = new Set(categories.map((category) => category.sectionId));
    for (const section of sections) {
      if (!present.has(section.id)) categories.push({ sectionId: section.id, title: section.title, count: 0 });
    }
    categories.sort((a, b) => b.count - a.count || a.sectionId.localeCompare(b.sectionId));
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
    schemaVersion: 2,
    startedAt,
    lastCollectedAt: now,
    collectionDays: [...new Set([...(previous?.collectionDays ?? []), today])].filter((day) => day >= firstDay).sort(),
    observations: mergeObservations(previous?.observations ?? [], items, sections, firstDay, now),
    reports: previous?.reports ?? [],
  };
  state.reports = buildReports(state, firstDay, today, sections);
  return state;
};
