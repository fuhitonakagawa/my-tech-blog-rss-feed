import { load } from 'cheerio';
import { expect, it } from 'vitest';
import { sectionFeedUrls } from '../../../src/common/constants';
import { deduplicatedStatisticsSections } from '../../../src/feed/deduplication/service';
import { updateStatistics } from '../../../src/feed/statistics/aggregate';
import { statisticsDisplayRows } from '../../../src/feed/statistics/display-rows';
import type { StatisticsSection } from '../../../src/feed/statistics/observations';
import { renderDailyReport } from '../../../src/feed/statistics/presentation';
import { parseStatisticsState } from '../../../src/feed/statistics/state-store';
import { renderStatisticsReport } from '../../../src/site/_includes/components/statistics-report';
import { makeSourceItem } from '../../helpers/translation-fixtures';

const definition = {
  id: 'zenn-dedup',
  title: 'Zenn dedup',
  sourceSectionIds: ['zenn-ai', 'zenn-cloud', 'zenn-security'],
  priority: 1,
};
const sections: StatisticsSection[] = [
  ...['AI', 'Cloud', 'Security'].map(
    (title): StatisticsSection => ({
      id: `zenn-${title.toLowerCase()}`,
      title: `Zenn ${title}${title === 'Security' ? 'タグ' : '関連タグ'}`,
      feedInfoList: [{ url: `https://example.com/${title.toLowerCase()}/rss`, label: title }],
    }),
  ),
  ...deduplicatedStatisticsSections([definition]),
];
const item = (id: string, sectionId: string, isoDate = '2026-09-30T00:00:00.000Z') =>
  makeSourceItem({
    link: `https://example.com/${id}`,
    sectionId,
    isoDate,
    sourceFeedUrl:
      sectionId === 'zenn-dedup'
        ? sectionFeedUrls(sectionId).rss
        : `https://example.com/${sectionId.replace('zenn-', '')}/rss`,
  });
const items = [
  item('shared', 'zenn-ai'),
  item('shared', 'zenn-cloud'),
  item('ai-only', 'zenn-ai'),
  item('other-owner', 'zenn-ai'),
  item('shared', 'zenn-dedup'),
  item('ai-only', 'zenn-dedup'),
];
const reportState = (input = items) => {
  const start = updateStatistics(null, input, sections, new Date('2026-09-30T12:00:00.000Z'));
  return updateStatistics(start, [], sections, new Date('2026-09-30T15:00:00.000Z'));
};

it('dedup掲載記事だけの所属を数え、複数カテゴリ所属と0件を保持する', () => {
  const state = reportState();
  const report = state.reports[0];
  const rows = statisticsDisplayRows(report.categories);
  expect(rows).toHaveLength(1);
  expect(rows[0].category.count).toBe(2);
  expect(rows[0].parts).toEqual([
    { title: 'AI', count: 2 },
    { title: 'Cloud', count: 1 },
    { title: 'Security', count: 0 },
  ]);
  expect(rows[0].children.find((category) => category.sectionId === 'zenn-ai')?.count).toBe(3);
  const rss = load(renderDailyReport(report));
  expect(rss.text()).toContain('Zenn dedup：2件（AI 2件 / Cloud 1件 / Security 0件）');
  expect(rss.text()).not.toContain('Zenn dedup（生成RSS）');
  expect(rss('ul > li')).toHaveLength(1);
  const web = load(renderStatisticsReport(report));
  expect(web('.ui-statistics-category')).toHaveLength(1);
  expect(web('.ui-statistics-child-category')).toHaveLength(3);
  expect(web('a[href="https://example.com/ai/rss"]')).toHaveLength(1);
  expect(parseStatisticsState(JSON.stringify(state))).toEqual(state);
});

it('所属を確認できない記事を推測せず、所属不明として表示する', () => {
  const report = reportState([...items, item('unknown', 'zenn-dedup')]).reports[0];
  const row = statisticsDisplayRows(report.categories)[0];
  expect(row.category.count).toBe(3);
  expect(row.parts).toContainEqual({ title: '所属不明', count: 1 });
});

it('元カテゴリとdedupの計上日に差があっても、記事の所属を保持する', () => {
  const initial = updateStatistics(null, [], sections, new Date('2026-09-28T15:00:00.000Z'));
  const state = updateStatistics(
    initial,
    [item('shared', 'zenn-ai', '2026-09-29T00:00:00.000Z'), item('shared', 'zenn-dedup')],
    sections,
    new Date('2026-09-30T15:00:00.000Z'),
  );
  expect(
    state.reports[0].categories.find((category) => category.sectionId === 'zenn-dedup')?.sourceCategories,
  ).toContainEqual({ sectionId: 'zenn-ai', title: 'Zenn AI関連タグ', count: 1 });
});

it('保存された内訳の負数・重複・総数を超える単一内訳を拒否する', () => {
  for (const count of [-1, 3]) {
    const state = reportState();
    const parts = state.reports[0].categories.find((category) => category.sectionId === 'zenn-dedup')?.sourceCategories;
    if (!parts) throw new Error('内訳がありません');
    parts[0].count = count;
    expect(() => parseStatisticsState(JSON.stringify(state))).toThrow();
  }
  const state = reportState();
  const parts = state.reports[0].categories.find((category) => category.sectionId === 'zenn-dedup')?.sourceCategories;
  if (!parts) throw new Error('内訳がありません');
  parts.push(parts[0]);
  expect(() => parseStatisticsState(JSON.stringify(state))).toThrow();
});
