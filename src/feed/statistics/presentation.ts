import { sectionPageUrl } from '../../common/constants';
import { escapeHtml } from '../../site/_includes/components/html-utils';
import type { DailyReport } from './types';

/** 日次記事の見出し。 */
export const dailyReportTitle = (date: string): string => `【日次統計】${date}のカテゴリ別投稿数`;

/** RSSと閲覧ページに共通する、全カテゴリ分の本文。 */
export const renderDailyReport = (report: DailyReport): string => {
  const [year, month, day] = report.date.split('-');
  const counts =
    report.categories.length > 0
      ? `<ul>${report.categories.map((category) => `<li><a href="${escapeHtml(sectionPageUrl(category.sectionId))}">${escapeHtml(category.title)}</a>：${category.count}件</li>`).join('')}</ul>`
      : '<p>対象日に公開された記事は取得できませんでした。</p>';
  const coverage =
    report.coverage === 'partial'
      ? '<p>収集開始日のため、開始前に配信元RSSから消えた記事は含まれません。</p>'
      : report.coverage === 'unobserved'
        ? '<p>この日は巡回記録がなく、後日に取得できた記事から集計しています。</p>'
        : '';
  return `<p>${year}年${month}月${day}日（日本時間）の新着記事をまとめました。</p>
    <p><strong>カテゴリ別投稿数</strong></p>${counts}${coverage}
    <p>このサイトで取得できた記事を集計しています。翻訳版と同一カテゴリ内の重複記事は除いています。投稿が0件のカテゴリは省略しています。</p>`;
};
