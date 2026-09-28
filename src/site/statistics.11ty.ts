import { statisticsConfig, statisticsFeedUrls } from '../feed/statistics/config';
import { dailyReportTitle, renderDailyReport } from '../feed/statistics/presentation';
import type { StatisticsState } from '../feed/statistics/types';
import { escapeHtml } from './_includes/components/html-utils';
import { renderNav } from './_includes/components/nav';
import { type EleventyPage, SITE_PAGE_DATE } from './_includes/components/types';

interface StatisticsPageData {
  page: EleventyPage;
  statistics: StatisticsState | null;
}

export const data = {
  layout: 'layouts/main.11ty.ts',
  date: SITE_PAGE_DATE,
  permalink: statisticsConfig.pagePath,
  pageTitle: statisticsConfig.title,
  feedDir: statisticsConfig.feedPath,
  eleventyComputed: {
    lastUpdated: (data: StatisticsPageData): string =>
      data.statistics?.reports.reduce(
        (last, report) => (report.updatedAt > last ? report.updatedAt : last),
        data.statistics.startedAt,
      ) ?? '',
  },
};

/** 過去の日次記事と購読リンクを表示する。 */
export const render = ({ page, statistics }: StatisticsPageData): string => {
  const reports = statistics?.reports ?? [];
  const content =
    reports.length > 0
      ? reports
          .map(
            (report) =>
              `<article id="${escapeHtml(report.date)}"><h2>${escapeHtml(dailyReportTitle(report.date))}</h2>${renderDailyReport(report)}</article>`,
          )
          .join('\n')
      : '<p>記事の取得履歴を収集中です。日本時間で収集開始日の翌日から日次統計を配信します。</p>';
  return `${renderNav(page)}<section class="ui-section-content"><div class="ui-layout-container">
    <h1>${escapeHtml(statisticsConfig.title)}</h1>
    <p><a href="${escapeHtml(statisticsFeedUrls.rss)}">日次統計のRSSを購読</a>・<a href="${escapeHtml(statisticsFeedUrls.atom)}">Atom</a>・<a href="${escapeHtml(statisticsFeedUrls.json)}">JSON Feed</a></p>
    <p>日本時間の前日までに公開され、このサイトで取得できた記事をカテゴリ別に集計しています。</p>
    ${content}</div></section>`;
};
