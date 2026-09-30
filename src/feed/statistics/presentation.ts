import { sectionFeedUrls } from '../../common/constants';
import { escapeHtml } from '../../site/_includes/components/html-utils';
import { type StatisticsDisplayRow, statisticsBreakdownText, statisticsDisplayRows } from './display-rows';
import type { DailyReport } from './types';

/** 集約RSSと取得元RSSの件数を階層表示する。 */
const renderCategory = (row: StatisticsDisplayRow): string => {
  const { category } = row;
  const sources = (row.grouped ? [] : category.feeds)
    .map((feed) => {
      const title = feed.url
        ? `<a href="${escapeHtml(feed.url)}">${escapeHtml(feed.title)}</a>`
        : escapeHtml(feed.title);
      return `<li>${title}${feed.kind === 'generated' ? '（生成RSS）' : ''}：${feed.count}件</li>`;
    })
    .join('');
  return `<li><a href="${escapeHtml(sectionFeedUrls(category.sectionId).rss)}">${escapeHtml(category.title)}</a>：${category.count}件${escapeHtml(statisticsBreakdownText(row))}${sources ? `<br><ul>${sources}</ul>` : ''}</li>`;
};

/** 日次記事の見出し。 */
export const dailyReportTitle = (date: string): string => `【日次統計】${date}のカテゴリ別投稿数`;

/** 統計フィードで配信する、全カテゴリ分の本文。 */
export const renderDailyReport = (report: DailyReport): string => {
  const [year, month, day] = report.date.split('-');
  const counts =
    report.categories.length > 0
      ? `<ul>${statisticsDisplayRows(report.categories).map(renderCategory).join('')}</ul>`
      : '<p>対象日に公開された記事は取得できませんでした。</p>';
  const coverage =
    report.coverage === 'partial'
      ? '<p>収集開始日のため、開始前に配信元RSSから消えた記事は含まれません。</p>'
      : report.coverage === 'unobserved'
        ? '<p>この日は巡回記録がなく、後日に取得できた記事から集計しています。</p>'
        : '';
  return `<p>${year}年${month}月${day}日（日本時間）の新着記事をまとめました。</p>
    <p><strong>カテゴリ別投稿数</strong></p>${counts}${coverage}
    <p>元記事の公開日で集計しています。dedupの内訳は実際に掲載した記事の元カテゴリ所属です。複数カテゴリに属する記事は各内訳に含むため、内訳の合計は総数を超える場合があります。enは英語の取得元の記事数、translated-jpは翻訳版RSSの掲載数で、原文フォールバックも含みます。翻訳版を原文の総数へ加算しません。個別RSSの内訳は日次統計ページで確認できます。0件のカテゴリも表示します。</p>`;
};
