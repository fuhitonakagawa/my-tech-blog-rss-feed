import constants from '../../common/constants';
import definition from '../../resources/stats/daily.json' with { type: 'json' };

export interface StatisticsDefinition {
  schemaVersion: 1;
  title: string;
  timeZone: 'Asia/Tokyo';
  retentionDays: number;
}

/** 日次統計の定義を検証する。集計日は日本時間に限定する。 */
export const parseStatisticsDefinition = (value: unknown): StatisticsDefinition => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('日次統計の定義が不正です');
  const config = value as Record<string, unknown>;
  const keys = new Set(['schemaVersion', 'title', 'timeZone', 'retentionDays']);
  if (Object.keys(config).some((key) => !keys.has(key))) throw new Error('日次統計の未知の設定項目です');
  if (
    config.schemaVersion !== 1 ||
    typeof config.title !== 'string' ||
    config.title.trim() === '' ||
    config.title.length > 200 ||
    config.timeZone !== 'Asia/Tokyo' ||
    typeof config.retentionDays !== 'number' ||
    !Number.isSafeInteger(config.retentionDays) ||
    config.retentionDays < 1 ||
    config.retentionDays > 365
  )
    throw new Error('日次統計の設定値が不正です');
  return { schemaVersion: 1, title: config.title, timeZone: 'Asia/Tokyo', retentionDays: config.retentionDays };
};

/** 日次統計の配信先と保存上限。 */
export const statisticsConfig = {
  ...parseStatisticsDefinition(definition),
  maxStateBytes: 20 * 1024 * 1024,
  feedPath: 'feeds/statistics/daily/',
  pagePath: 'statistics/daily/',
};

export const statisticsPageUrl = `${constants.siteUrl}${statisticsConfig.pagePath}`;
export const statisticsFeedUrls = {
  rss: `${constants.siteUrl}${statisticsConfig.feedPath}rss.xml`,
  atom: `${constants.siteUrl}${statisticsConfig.feedPath}atom.xml`,
  json: `${constants.siteUrl}${statisticsConfig.feedPath}feed.json`,
};
