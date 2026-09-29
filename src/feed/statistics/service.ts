import type { TranslatedFeedDefinition } from '../../resources/translated-feed-list';
import type { CustomRssParserItem } from '../feed-crawler';
import { FeedValidator } from '../feed-validator';
import { logger } from '../logger';
import { updateStatistics } from './aggregate';
import { statisticsConfig } from './config';
import { buildStatisticsFeed } from './feed-builder';
import { type StatisticsSection, observationKey } from './observations';
import { parseStatisticsState, readStatisticsState, writeStatisticsFile } from './state-store';
import type { ArticleObservation, StatisticsState } from './types';

/** 同じ収集履歴の未公開取得分を保持し、公開済みの記事情報を優先する。 */
const combineHistory = (published: StatisticsState, cached: StatisticsState): StatisticsState => {
  if (published.startedAt !== cached.startedAt || cached.lastCollectedAt <= published.lastCollectedAt) return published;
  const observations = new Map<string, ArticleObservation>();
  for (const item of [...cached.observations, ...published.observations]) {
    const key = observationKey(item);
    observations.set(key, {
      ...item,
      inTranslatedFeed: item.inTranslatedFeed || observations.get(key)?.inTranslatedFeed === true,
    });
  }
  const reports = new Map(published.reports.map((report) => [report.date, report]));
  for (const report of cached.reports) {
    const old = reports.get(report.date);
    if (!old || report.updatedAt > old.updatedAt) reports.set(report.date, report);
  }
  return {
    ...published,
    lastCollectedAt: cached.lastCollectedAt,
    collectionDays: [...new Set([...published.collectionDays, ...cached.collectionDays])],
    observations: [...observations.values()],
    reports: [...reports.values()],
  };
};

/** 公開済み履歴を基準に、正常なキャッシュから取得記録を復元する。 */
const restoreStatistics = async (
  publishedDirectory: string,
  outputDirectory: string,
  publishedOnlySectionIds: readonly string[],
): Promise<StatisticsState | null> => {
  let failure: unknown;
  const states: (StatisticsState | null)[] = [];
  for (const [source, directory] of [
    ['published', publishedDirectory],
    ['cache', outputDirectory],
  ]) {
    try {
      const state = await readStatisticsState(directory);
      states.push(
        state && source === 'cache'
          ? {
              ...state,
              observations: state.observations.filter((item) => !publishedOnlySectionIds.includes(item.sectionId)),
            }
          : state,
      );
    } catch (error) {
      failure = error;
      states.push(null);
      logger.warn('[statistics] invalid-state', { source });
    }
  }
  const [published, cached] = states;
  if (published && cached) return combineHistory(published, cached);
  if (published || cached) return published || cached;
  if (failure) throw new Error('日次統計の履歴を復元できません', { cause: failure });
  return null;
};

/** 通常の取得結果から履歴と日次フィードを生成する。 */
export const generateStatistics = async (
  items: readonly CustomRssParserItem[],
  sections: readonly StatisticsSection[],
  publishedDirectory: string,
  outputDirectory: string,
  currentDate = new Date(),
  translations: readonly TranslatedFeedDefinition[] = [],
  translatedItems: readonly CustomRssParserItem[] = [],
  publishedOnlySectionIds: readonly string[] = [],
): Promise<StatisticsState> => {
  const previous = await restoreStatistics(publishedDirectory, outputDirectory, publishedOnlySectionIds);
  const state = updateStatistics(previous, items, sections, currentDate, translations, translatedItems);
  const json = `${JSON.stringify(state)}\n`;
  if (Buffer.byteLength(json) > statisticsConfig.maxStateBytes) throw new Error('日次統計の保存上限を超えています');
  parseStatisticsState(json);
  const feeds = buildStatisticsFeed(state);
  const validator = new FeedValidator();
  await validator.assertXmlFeed('daily-statistics-rss', feeds.rss);
  await validator.assertXmlFeed('daily-statistics-atom', feeds.atom);
  await Promise.all([
    writeStatisticsFile(outputDirectory, 'rss.xml', feeds.rss),
    writeStatisticsFile(outputDirectory, 'atom.xml', feeds.atom),
    writeStatisticsFile(outputDirectory, 'feed.json', feeds.json),
  ]);
  await writeStatisticsFile(outputDirectory, 'state.json', json);
  logger.info('[statistics] generated', { reports: state.reports.length, observations: state.observations.length });
  return state;
};
