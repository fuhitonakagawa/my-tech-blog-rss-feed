import { statisticsConfig, statisticsFeedUrls } from '../feed/statistics/config';
import type { StatisticsState } from '../feed/statistics/types';
import { escapeHtml } from './_includes/components/html-utils';
import { renderNav } from './_includes/components/nav';
import { indexScript } from './_includes/components/scripts';
import { renderStatisticsReport } from './_includes/components/statistics-report';
import { renderTopSection } from './_includes/components/top-section';
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
      ? reports.map(renderStatisticsReport).join('\n')
      : '<p class="ui-statistics-empty">記事の取得履歴を収集中です。日本時間で収集開始日の翌日から日次統計を配信します。上のRSS URLから購読できます。</p>';
  return `${renderTopSection(page, statisticsFeedUrls.rss)}
    ${renderNav(page)}<section class="ui-section-content ui-section-feed ui-statistics"><div class="ui-layout-container">
    <header class="ui-statistics-heading">
    <h1 class="ui-typography-heading">${escapeHtml(statisticsConfig.title)}</h1>
    <p>日本時間の前日までに公開され、このサイトで取得できた記事をカテゴリ別に集計しています。</p>
    <p class="ui-statistics-subscriptions"><a href="${escapeHtml(statisticsFeedUrls.rss)}">RSSを購読</a><a href="${escapeHtml(statisticsFeedUrls.atom)}">Atom</a><a href="${escapeHtml(statisticsFeedUrls.json)}">JSON Feed</a></p>
    </header>
    ${content}
    <p class="ui-statistics-footnote">件数の多いカテゴリから表示しています。0件は対象日の記事を取得できていないことを示します。翻訳版と同一カテゴリ内の重複記事は除いています。カテゴリをまたぐ同じ記事は、それぞれで数えるため、合計は延べ件数です。</p>
    </div></section>
    <script>${indexScript}</script>`;
};
