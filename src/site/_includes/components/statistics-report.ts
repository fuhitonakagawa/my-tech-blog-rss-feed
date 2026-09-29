import { sectionFeedUrls, sectionPageUrl } from '../../../common/constants';
import type { CategoryCount, DailyReport, SourceCount } from '../../../feed/statistics/types';
import { escapeHtml } from './html-utils';

/** 日付を日本語の見出しへ整える。 */
const reportDateLabel = (date: string): string => {
  const [year, month, day] = date.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
};

/** RSS名・URL・件数をカテゴリの子項目として表示する。 */
const renderSourceCount = (feed: SourceCount): string => {
  const name = feed.url
    ? `<a href="${escapeHtml(feed.url)}">${escapeHtml(feed.title)}</a><small class="ui-statistics-feed-url">${escapeHtml(feed.url)}</small>`
    : escapeHtml(feed.title);
  return `<li><span>${name}${feed.kind === 'generated' ? '<small class="ui-statistics-source-kind">生成RSS</small>' : ''}</span>
    <span class="ui-statistics-count">${feed.count.toLocaleString('ja-JP')}件</span></li>`;
};

/** カテゴリを展開すると全取得元の件数と購読リンクを確認できる。 */
const renderCategoryGroup = (categories: readonly CategoryCount[], label: string): string =>
  `<ul class="ui-statistics-categories" aria-label="${escapeHtml(label)}">${categories
    .map(
      (category) => `
    <li class="ui-statistics-category" data-section="${escapeHtml(category.sectionId)}">
      <details class="ui-statistics-details">
        <summary><span class="ui-statistics-category-title">${escapeHtml(category.title)}</span>
          <span class="ui-statistics-count">${category.count.toLocaleString('ja-JP')}件</span>
          <span class="ui-statistics-toggle" aria-hidden="true"></span></summary>
        <div class="ui-statistics-breakdown">
          <p class="ui-statistics-category-links"><a href="${escapeHtml(sectionPageUrl(category.sectionId))}">カテゴリページ</a>
            <a href="${escapeHtml(sectionFeedUrls(category.sectionId).rss)}">カテゴリRSS</a></p>
          ${category.kind === 'translated' ? '<p class="ui-statistics-source-kind">翻訳元RSSごとの掲載件数</p>' : ''}
          ${category.feeds.length ? `<ul class="ui-statistics-sources">${category.feeds.map(renderSourceCount).join('')}</ul>` : '<p>取得元の内訳はありません。</p>'}
        </div>
      </details>
    </li>`,
    )
    .join('')}</ul>`;

/** 件数順の全カテゴリを、広い画面では左右の列に分ける。 */
const renderCategoryCounts = (report: DailyReport): string => {
  if (report.categories.length === 0) {
    return '<p class="ui-statistics-empty">対象日に公開された記事は取得できませんでした。</p>';
  }
  const middle = Math.ceil(report.categories.length / 2);
  const groups = [report.categories.slice(0, middle), report.categories.slice(middle)].filter(
    (group) => group.length > 0,
  );
  return `<div class="ui-statistics-columns">${groups
    .map((group, index) =>
      renderCategoryGroup(group, `${reportDateLabel(report.date)}のカテゴリ別投稿数・${index + 1}`),
    )
    .join('')}</div>`;
};

/** 取得範囲の制約を、件数と区別した注記として表示する。 */
const renderCoverageNote = (report: DailyReport): string => {
  if (report.coverage === 'partial') {
    return '<p class="ui-statistics-notice">部分集計：収集開始日のため、開始前に配信元RSSから消えた記事は含まれません。</p>';
  }
  if (report.coverage === 'unobserved') {
    return '<p class="ui-statistics-notice">巡回記録なし：この日は巡回記録がなく、後日に取得できた記事から集計しています。</p>';
  }
  return '';
};

/** 日付・延べ件数・カテゴリ内訳をひとまとまりに表示する。 */
export const renderStatisticsReport = (report: DailyReport): string => {
  const total = report.categories
    .filter((category) => category.kind === 'source')
    .reduce((sum, category) => sum + category.count, 0);
  const translated = report.categories
    .filter((category) => category.kind === 'translated')
    .reduce((sum, category) => sum + category.count, 0);
  const activeCategories = report.categories.filter((category) => category.count > 0).length;
  return `<article class="ui-statistics-report" id="${escapeHtml(report.date)}">
    <header class="ui-statistics-report__header">
      <div><p class="ui-statistics-eyebrow">集計対象日・日本時間</p>
        <h2><time datetime="${escapeHtml(report.date)}">${escapeHtml(reportDateLabel(report.date))}</time></h2>
      </div>
      <dl class="ui-statistics-metrics">
        <div><dt>原文カテゴリ合計（延べ）</dt><dd>${total.toLocaleString('ja-JP')}<span class="ui-statistics-unit">件</span></dd></div>
        <div><dt>翻訳版の掲載</dt><dd>${translated.toLocaleString('ja-JP')}<span class="ui-statistics-unit">件</span></dd></div>
        <div><dt>投稿のあるカテゴリ</dt><dd>${activeCategories}<span class="ui-statistics-unit">カテゴリ</span></dd></div>
      </dl>
    </header>
    ${renderCoverageNote(report)}
    ${renderCategoryCounts(report)}
  </article>`;
};
