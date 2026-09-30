import type { TranslatedFeedDefinition } from '../../resources/translated-feed-list';
import type { CustomRssParserItem } from '../feed-crawler';
import { statisticsConfig } from './config';
import { countCategories, observationsByDay } from './counts';
import { dayStart, jstDay, shiftDay } from './dates';
import { type StatisticsSection, mergeObservations } from './observations';
import type { DailyReport, StatisticsState } from './types';

/** 終了した日だけを集計し、同じ内容の更新日時を維持する。 */
const buildReports = (
  state: StatisticsState,
  firstDay: string,
  today: string,
  sections: readonly StatisticsSection[],
  translations: readonly TranslatedFeedDefinition[],
): DailyReport[] => {
  const days = observationsByDay(state.observations);
  const previous = new Map(state.reports.map((report) => [report.date, report]));
  const collectedDays = new Set(state.collectionDays);
  const reports: DailyReport[] = [];
  for (let date = firstDay; date < today; date = shiftDay(date, 1)) {
    const coverage = !collectedDays.has(date)
      ? 'unobserved'
      : date === jstDay(state.startedAt) && state.startedAt !== dayStart(date)
        ? 'partial'
        : 'observed';
    const categories = countCategories(days.get(date) ?? [], sections, translations, state.observations);
    const old = previous.get(date);
    reports.push({
      date,
      publishedAt: dayStart(shiftDay(date, 1)),
      updatedAt:
        old && old.coverage === coverage && isDeepStrictEqual(old.categories, categories)
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
  translations: readonly TranslatedFeedDefinition[] = [],
  translatedItems: readonly CustomRssParserItem[] = [],
): StatisticsState => {
  const now = currentDate.toISOString();
  if (previous && now < previous.lastCollectedAt) throw new Error('保存済み履歴より前の時刻では集計できません');
  const today = jstDay(now);
  const startedAt = previous?.startedAt ?? now;
  const startedDay = jstDay(startedAt);
  const cutoffDay = shiftDay(today, -statisticsConfig.retentionDays);
  const firstDay = startedDay > cutoffDay ? startedDay : cutoffDay;
  const state: StatisticsState = {
    schemaVersion: 3,
    startedAt,
    lastCollectedAt: now,
    collectionDays: [...new Set([...(previous?.collectionDays ?? []), today])].filter((day) => day >= firstDay).sort(),
    observations: mergeObservations(previous?.observations ?? [], items, sections, firstDay, now, translatedItems),
    reports: previous?.reports ?? [],
  };
  state.reports = buildReports(state, firstDay, today, sections, translations);
  return state;
};
import { isDeepStrictEqual } from 'node:util';
