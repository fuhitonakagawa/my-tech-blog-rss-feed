import { sectionPageUrl } from '../../../common/constants';
import type { CategoryCount, DailyReport } from '../../../feed/statistics/types';
import { escapeHtml } from './html-utils';

/** 日付を日本語の見出しへ整える。 */
const reportDateLabel = (date: string): string => {
  const [year, month, day] = date.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
};

/** カテゴリ名と件数を、見出し付きの表で表示する。 */
const renderCategoryTable = (categories: readonly CategoryCount[], label: string): string => {
  const rows = categories
    .map(
      (category) => `<tr>
        <th scope="row"><a href="${escapeHtml(sectionPageUrl(category.sectionId))}">${escapeHtml(category.title)}</a></th>
        <td>${category.count.toLocaleString('ja-JP')}<span class="ui-statistics-unit">件</span></td>
      </tr>`,
    )
    .join('');
  return `<table class="ui-statistics-table" aria-label="${escapeHtml(label)}">
    <thead><tr><th scope="col">カテゴリ</th><th scope="col">投稿数</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
};

/** 件数順の全カテゴリを、広い画面では左右の表に分ける。 */
const renderCategoryCounts = (report: DailyReport): string => {
  if (report.categories.length === 0) {
    return '<p class="ui-statistics-empty">対象日に公開された記事は取得できませんでした。</p>';
  }
  const middle = Math.ceil(report.categories.length / 2);
  const groups = [report.categories.slice(0, middle), report.categories.slice(middle)].filter(
    (group) => group.length > 0,
  );
  return `<div class="ui-statistics-tables">${groups
    .map((group, index) =>
      renderCategoryTable(group, `${reportDateLabel(report.date)}のカテゴリ別投稿数・${index + 1}`),
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
  const total = report.categories.reduce((sum, category) => sum + category.count, 0);
  const activeCategories = report.categories.filter((category) => category.count > 0).length;
  return `<article class="ui-statistics-report" id="${escapeHtml(report.date)}">
    <header class="ui-statistics-report__header">
      <div><p class="ui-statistics-eyebrow">集計対象日・日本時間</p>
        <h2><time datetime="${escapeHtml(report.date)}">${escapeHtml(reportDateLabel(report.date))}</time></h2>
      </div>
      <dl class="ui-statistics-metrics">
        <div><dt>カテゴリ合計（延べ）</dt><dd>${total.toLocaleString('ja-JP')}<span class="ui-statistics-unit">件</span></dd></div>
        <div><dt>投稿のあるカテゴリ</dt><dd>${activeCategories}<span class="ui-statistics-unit">カテゴリ</span></dd></div>
      </dl>
    </header>
    ${renderCoverageNote(report)}
    ${renderCategoryCounts(report)}
  </article>`;
};
