import { Feed } from 'feed';
import constants from '../../common/constants';
import type { FeedDistributionSet } from '../feed-generator';
import { statisticsConfig, statisticsFeedUrls, statisticsPageUrl } from './config';
import { dailyReportTitle, renderDailyReport } from './presentation';
import type { StatisticsState } from './types';

/** 日次統計は日付をIDとし、カテゴリ一覧を省略せず配信する。 */
export const buildStatisticsFeed = (state: StatisticsState): FeedDistributionSet => {
  const updated = state.reports.reduce(
    (last, report) => (report.updatedAt > last ? report.updatedAt : last),
    state.startedAt,
  );
  const feed = new Feed({
    title: statisticsConfig.title,
    description: '日本時間の前日までに公開され、取得できた記事のカテゴリ別件数',
    id: statisticsPageUrl,
    link: statisticsPageUrl,
    language: 'ja',
    copyright: constants.feedCopyright,
    feedLinks: statisticsFeedUrls,
    updated: new Date(updated),
  });
  for (const report of state.reports) {
    const url = `${statisticsPageUrl}#${report.date}`;
    feed.addItem({
      id: url,
      guid: url,
      link: url,
      title: dailyReportTitle(report.date),
      description: `${report.date}（日本時間）のカテゴリ別投稿数。${report.categories.filter((category) => category.count > 0).length}カテゴリで記事を取得しました。`,
      content: renderDailyReport(report),
      published: new Date(report.publishedAt),
      date: new Date(report.updatedAt),
    });
  }
  return { rss: feed.rss2(), atom: feed.atom1(), json: feed.json1() };
};
