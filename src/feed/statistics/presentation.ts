import { sectionFeedUrls } from '../../common/constants';
import { escapeHtml } from '../../site/_includes/components/html-utils';
import type { CategoryCount, DailyReport } from './types';

/** 集約RSSと取得元RSSの件数を階層表示する。 */
const renderCategory = (category: CategoryCount): string => {
  const sources = category.feeds
    .map((feed) => {
      const title = feed.url
        ? `<a href="${escapeHtml(feed.url)}">${escapeHtml(feed.title)}</a>`
        : escapeHtml(feed.title);
      return `<li>${title}${feed.kind === 'generated' ? '（生成RSS）' : ''}：${feed.count}件</li>`;
    })
    .join('');
  return `<li><a href="${escapeHtml(sectionFeedUrls(category.sectionId).rss)}">${escapeHtml(category.title)}</a>：${category.count}件${sources ? `<ul>${sources}</ul>` : ''}</li>`;
};

/** 日次記事の見出し。 */
export const dailyReportTitle = (date: string): string => `【日次統計】${date}のカテゴリ別投稿数`;

/** 統計フィードで配信する、全カテゴリ分の本文。 */
export const renderDailyReport = (report: DailyReport): string => {
  const [year, month, day] = report.date.split('-');
  const counts =
    report.categories.length > 0
      ? `<ul>${report.categories.map(renderCategory).join('')}</ul>`
      : '<p>対象日に公開された記事は取得できませんでした。</p>';
  const coverage =
    report.coverage === 'partial'
      ? '<p>収集開始日のため、開始前に配信元RSSから消えた記事は含まれません。</p>'
      : report.coverage === 'unobserved'
        ? '<p>この日は巡回記録がなく、後日に取得できた記事から集計しています。</p>'
        : '';
  return `<p>${year}年${month}月${day}日（日本時間）の新着記事をまとめました。</p>
    <p><strong>カテゴリ別投稿数</strong></p>${counts}${coverage}
    <p>元記事の公開日で集計しています。カテゴリ内の重複記事は除きますが、複数RSSに同じ記事が載る場合、内訳の合計とカテゴリ件数は一致しません。翻訳版はRSSへの掲載件数で、原文フォールバックも含みます。重複除外版は配信先に選ばれた記事だけを数えます。0件は対象日の掲載記事を記録できていないことを示します。</p>`;
};
