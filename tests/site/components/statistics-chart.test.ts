import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import type { DailyReport } from '../../../src/feed/statistics/types';
import { renderStatisticsChart } from '../../../src/site/_includes/components/statistics-chart';
import { render as renderStatisticsPage } from '../../../src/site/statistics.11ty';

const report = (date: string, count: number, coverage: DailyReport['coverage'] = 'observed'): DailyReport => ({
  date,
  publishedAt: `${date}T15:00:00.000Z`,
  updatedAt: `${date}T15:00:00.000Z`,
  coverage,
  categories: [
    { sectionId: 'source', title: '原文', kind: 'source', count, feeds: [] },
    { sectionId: 'translated', title: '翻訳', kind: 'translated', count: 100, feeds: [] },
    { sectionId: 'dedup', title: 'dedup', kind: 'deduplicated', count: 100, feeds: [] },
  ],
});

describe('日付ごとの投稿数グラフ', () => {
  it('入力を変更せず日付順に並べ、原文合計と週末の曜日をグラフと表に表示する', () => {
    const reports = [report('2026-10-05', 0), report('2026-10-04', 150), report('2026-10-03', 300)];
    const saved = structuredClone(reports);
    const html = load(renderStatisticsChart(reports));
    expect(
      html('.ui-statistics-chart-day')
        .slice(-3)
        .map((_, element) => html(element).attr('data-date'))
        .get(),
    ).toEqual(['2026-10-03', '2026-10-04', '2026-10-05']);
    expect(html('[data-date="2026-10-03"] .ui-statistics-saturday').text()).toBe('10/3（土）');
    expect(html('[data-date="2026-10-04"] .ui-statistics-sunday').text()).toBe('10/4（日）');
    expect(
      html('[data-date="2026-10-05"] .ui-statistics-saturday, [data-date="2026-10-05"] .ui-statistics-sunday'),
    ).toHaveLength(0);
    expect(
      html('tbody td:nth-child(2)')
        .slice(-3)
        .map((_, element) => html(element).text())
        .get(),
    ).toEqual(['300件', '150件', '0件']);
    const heights = html('rect')
      .map((_, element) => Number(html(element).attr('height')))
      .get();
    expect(heights[0]).toBeGreaterThan(0);
    expect(heights[0]).toBe(heights[1] * 2);
    expect(heights[2]).toBe(0);
    const sundayLink = html('a[href="#2026-10-04"]');
    expect(sundayLink.text()).toBe('詳細へ ↓');
    expect(sundayLink.attr('aria-label')).toBe('2026-10-04の詳細へ');
    expect(sundayLink.siblings('.ui-statistics-sunday').text()).toBe('2026-10-04（日）');
    expect(html('a[href="#2026-10-03"]').siblings('.ui-statistics-saturday').text()).toBe('2026-10-03（土）');
    expect(html('a[href="#2026-10-05"]').siblings('span').text()).toBe('2026-10-05（月）');
    expect(html('tbody a.ui-statistics-saturday, tbody a.ui-statistics-sunday')).toHaveLength(0);
    expect(html('svg').attr('aria-labelledby')).toBe('daily-chart-title daily-chart-description');
    expect(html('.ui-statistics-chart-scroll').attr('tabindex')).toBe('0');
    expect(reports).toEqual(saved);
  });

  it.each([0, 1, 12_345])('全日%s件でも0始まりの目盛りと範囲内の棒を描く', (count) => {
    const markup = renderStatisticsChart([report('2026-10-04', count)]);
    const html = load(markup);
    expect(markup).not.toMatch(/NaN|Infinity/);
    expect(html('.ui-statistics-chart-tick').first().text()).toBe('0');
    expect(Number(html('.ui-statistics-chart-tick').last().text().replaceAll(',', ''))).toBeGreaterThanOrEqual(count);
    expect(Number(html('rect').attr('height'))).toBeGreaterThanOrEqual(0);
    expect(Number(html('rect').attr('height'))).toBeLessThanOrEqual(210);
  });

  it('最新集計日までの30日だけを年をまたいで表示し、範囲外の件数を目盛りへ含めない', () => {
    const reports = Array.from({ length: 90 }, (_, index) =>
      report(
        new Date(Date.UTC(2026, 9, 10 + index)).toISOString().slice(0, 10),
        index < 60 ? 100_000 : index,
        index === 60 ? 'partial' : index === 61 ? 'unobserved' : 'observed',
      ),
    );
    const html = load(renderStatisticsChart(reports));
    expect(html('rect')).toHaveLength(30);
    expect(html('tbody tr')).toHaveLength(30);
    expect(Number(html('svg').attr('width'))).toBeGreaterThan(30 * 60);
    expect(html('[data-date="2026-12-09"]').text()).toContain('※');
    expect(html('[data-date="2026-12-08"]')).toHaveLength(0);
    expect(html('tbody tr').eq(0).text()).toContain('部分集計');
    expect(html('tbody tr').eq(1).text()).toContain('巡回記録なし');
    expect(html('a[href="#2027-01-07"]')).toHaveLength(1);
    expect(html('.ui-statistics-chart-tick').last().text()).toBe('120');
  });

  it('履歴の欠けた日は未集計とし、取得数0件の日と区別する', () => {
    const html = load(renderStatisticsChart([report('2026-10-03', 0), report('2026-09-28', 5, 'partial')]));
    expect(html('.ui-statistics-chart-day')).toHaveLength(30);
    expect(html('.ui-statistics-chart-day').first().attr('data-date')).toBe('2026-09-04');
    expect(html('[data-date="2026-09-27"] rect')).toHaveLength(0);
    expect(html('[data-date="2026-09-27"]').text()).toContain('未集計');
    expect(html('[data-date="2026-10-03"] rect')).toHaveLength(1);
    expect(html('a[href="#2026-09-27"]')).toHaveLength(0);
    expect(html('a[href="#2026-10-03"]').closest('tr').text()).toContain('0件');
  });

  it('集計日がなければグラフを表示せず収集中の案内を保つ', () => {
    expect(renderStatisticsChart([])).toBe('');
    const html = load(renderStatisticsPage({ page: { url: '/statistics/daily/' }, statistics: null }));
    expect(html('.ui-statistics-chart')).toHaveLength(0);
    expect(html('.ui-statistics-empty').text()).toContain('収集中');
  });
});
