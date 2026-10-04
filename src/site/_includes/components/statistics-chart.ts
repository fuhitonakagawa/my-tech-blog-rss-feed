import { shiftDay } from '../../../feed/statistics/dates';
import { statisticsOriginalTotal } from '../../../feed/statistics/display-rows';
import type { DailyReport } from '../../../feed/statistics/types';
import { escapeHtml } from './html-utils';

const CHART_DAYS = 30;
const PLOT_TOP = 40;
const PLOT_HEIGHT = 210;
const PLOT_LEFT = 64;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface ChartDay {
  date: string;
  report: DailyReport | undefined;
}

/** 最新集計日までの30日間を揃え、保存履歴のない日を0件と区別する。 */
const chartDays = (reports: readonly DailyReport[]): ChartDay[] => {
  const latest = reports.reduce((last, report) => (report.date > last ? report.date : last), reports[0].date);
  const byDate = new Map(reports.map((report) => [report.date, report]));
  return Array.from({ length: CHART_DAYS }, (_, index) => {
    const date = shiftDay(latest, index - CHART_DAYS + 1);
    return { date, report: byDate.get(date) };
  });
};

/** 保存済みの日本時間の日付から、実行環境に依存しない曜日を求める。 */
const weekday = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** 曜日の文字と色を併記するための表示クラス。 */
const dateClass = (date: string): string => {
  const day = weekday(date);
  return day === 6 ? 'ui-statistics-saturday' : day === 0 ? 'ui-statistics-sunday' : '';
};

/** 0件の日にも整数の目盛りを用意する。 */
const tickStep = (maximum: number): number => {
  const target = Math.max(1, maximum / 4);
  const unit = 10 ** Math.floor(Math.log10(target));
  return Math.ceil(target / unit) * unit;
};

/** 部分集計と巡回記録のない日を通常の集計から区別する。 */
const coverageLabel = (report: DailyReport): string =>
  report.coverage === 'partial' ? '部分集計' : report.coverage === 'unobserved' ? '巡回記録なし' : '巡回記録あり';

/** 総投稿数の目盛りと水平線を描画する。 */
const renderGrid = (width: number, step: number): string =>
  Array.from({ length: 5 }, (_, index) => {
    const y = PLOT_TOP + PLOT_HEIGHT - (PLOT_HEIGHT * index) / 4;
    return `<line class="ui-statistics-chart-grid" x1="${PLOT_LEFT}" x2="${width - 16}" y1="${y}" y2="${y}" />
<text class="ui-statistics-chart-tick" x="${PLOT_LEFT - 10}" y="${y + 5}" text-anchor="end">${(step * index).toLocaleString('ja-JP')}</text>`;
  }).join('');

/** 各日の棒・件数・曜日付き日付を同じ位置に配置する。 */
const renderBar = ({ date, report }: ChartDay, index: number, slot: number, maximum: number): string => {
  const total = report ? statisticsOriginalTotal(report.categories) : null;
  const height = ((total ?? 0) / maximum) * PLOT_HEIGHT;
  const x = PLOT_LEFT + slot * (index + 0.5);
  const y = PLOT_TOP + PLOT_HEIGHT - height;
  const [, month, day] = date.split('-');
  const note = report && report.coverage !== 'observed' ? ' ※' : '';
  return `<g class="ui-statistics-chart-day" data-date="${escapeHtml(date)}">
<title>${escapeHtml(date)}（${WEEKDAYS[weekday(date)]}）：${total === null ? '未集計' : `${total.toLocaleString('ja-JP')}件`}${report ? `・${coverageLabel(report)}` : ''}</title>
${total === null ? '' : `<rect class="ui-statistics-chart-bar" x="${x - 18}" y="${y}" width="36" height="${height}" rx="2" />`}
<text x="${x}" y="${y - 10}" text-anchor="middle">${total === null ? '未集計' : total.toLocaleString('ja-JP')}</text>
<text class="${dateClass(date)}" x="${x}" y="278" text-anchor="middle">${Number(month)}/${Number(day)}${note}</text>
<text class="${dateClass(date)}" x="${x}" y="298" text-anchor="middle">（${WEEKDAYS[weekday(date)]}）</text>
</g>`;
};

/** グラフと同じ値を表で読み、各日の詳細へ移動できる。 */
const renderTable = (days: readonly ChartDay[]): string =>
  `<details class="ui-statistics-chart-table"><summary>日付別の件数を表で見る</summary>
<table><caption>日付別の総投稿数（日本時間・原文カテゴリ合計）</caption>
<thead><tr><th scope="col">日付</th><th scope="col">総投稿数</th><th scope="col">収集状況</th></tr></thead>
<tbody>${days
    .map(({ date, report }) => {
      const label = `${escapeHtml(date)}（${WEEKDAYS[weekday(date)]}）`;
      return `<tr><th scope="row"><span class="ui-statistics-date-cell"><span class="${dateClass(date)}">${label}</span>${report ? `<a class="ui-statistics-date-link" href="#${escapeHtml(date)}" aria-label="${escapeHtml(date)}の詳細へ">詳細へ<span aria-hidden="true"> ↓</span></a>` : ''}</span></th><td>${report ? `${statisticsOriginalTotal(report.categories).toLocaleString('ja-JP')}件` : '—'}</td><td>${report ? coverageLabel(report) : '未集計'}</td></tr>`;
    })
    .join('')}</tbody></table></details>`;

/** 直近30日間の日次件数を古い日付から並べ、狭い画面ではグラフ内を横スクロールする。 */
export const renderStatisticsChart = (reports: readonly DailyReport[]): string => {
  if (reports.length === 0) return '';
  const days = chartDays(reports);
  const width = PLOT_LEFT + 64 * days.length + 16;
  const slot = (width - PLOT_LEFT - 16) / days.length;
  const step = tickStep(
    Math.max(...days.map(({ report }) => (report ? statisticsOriginalTotal(report.categories) : 0))),
  );
  return `<section class="ui-statistics-chart" aria-labelledby="daily-chart-heading">
<h2 id="daily-chart-heading">直近1か月の総投稿数</h2>
<p class="ui-text-note">${escapeHtml(days[0].date)} ～ ${escapeHtml(days[days.length - 1].date)}（日本時間・30日間）。原文カテゴリ合計の延べ件数です。カテゴリ間の重複を含み、翻訳版・dedupは加算しません。</p>
<div class="ui-statistics-chart-scroll" tabindex="0" role="region" aria-label="日付別投稿数の棒グラフ。横にスクロールできます。">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 340" width="${width}" height="340" role="img" aria-labelledby="daily-chart-title daily-chart-description">
<title id="daily-chart-title">日付ごとの総投稿数</title>
<desc id="daily-chart-description">縦軸は総投稿数、横軸は日本時間の日付。土曜日の日付は青、日曜日は赤。各日の値は下の表でも確認できます。</desc>
<text x="0" y="18">総投稿数（件）</text>
${renderGrid(width, step)}
${days.map((day, index) => renderBar(day, index, slot, step * 4)).join('')}
<text x="${PLOT_LEFT + (width - PLOT_LEFT) / 2}" y="330" text-anchor="middle">日付（日本時間）</text>
</svg></div>
<p class="ui-text-note">横にスクロールして各日を確認できます。<span class="ui-statistics-saturday">土曜日は青</span>、<span class="ui-statistics-sunday">日曜日は赤</span>。※は部分集計または巡回記録のない日です。未集計は保存履歴のない日で、0件とは異なります。</p>
${renderTable(days)}
</section>`;
};
