import { sectionFeedUrls } from '../../common/constants';
import { escapeHtml } from '../../site/_includes/components/html-utils';
import { statisticsPageUrl } from './config';
import {
  type StatisticsDisplayRow,
  statisticsBreakdownText,
  statisticsDisplayRows,
  statisticsOriginalTotal,
} from './display-rows';
import type { DailyReport } from './types';

/** 取得元RSSの詳細は閲覧ページに委ね、カテゴリごとに1行で表示する。 */
const renderCategory = (row: StatisticsDisplayRow): string => {
  const { category } = row;
  return `<li><a href="${escapeHtml(sectionFeedUrls(category.sectionId).rss)}">${escapeHtml(category.title)}</a>：${category.count}件${escapeHtml(statisticsBreakdownText(row))}</li>`;
};

/** 日次記事の見出し。 */
export const dailyReportTitle = (date: string): string => `【日次統計】${date}のカテゴリ別投稿数`;

/** 統計フィードで配信する、全カテゴリ分の本文。 */
export const renderDailyReport = (report: DailyReport): string => {
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
  return `<p><strong>合計投稿数：${statisticsOriginalTotal(report.categories).toLocaleString('ja-JP')}件（原文カテゴリ合計・延べ）</strong></p>
<p>全カテゴリ・取得元の詳細：<a href="${escapeHtml(`${statisticsPageUrl}#${report.date}`)}">${escapeHtml(`${statisticsPageUrl}#${report.date}`)}</a></p>
<p><strong>カテゴリ別投稿数（件数順）</strong></p>${counts}${coverage}
<p>元記事の公開日で集計。合計はカテゴリ間の重複を含み、翻訳版・dedupを加算しません。dedupの内訳は掲載記事の元カテゴリ所属で、複数所属を含みます。en・zhは原文の取得数、translated-jpは原文フォールバックを含む翻訳版掲載数です。0件は未取得の場合もあります。</p>`;
};
