import { describe, expect, it } from 'vitest';
import { updateStatistics } from '../../../src/feed/statistics/aggregate';
import type { StatisticsSection } from '../../../src/feed/statistics/observations';
import { parseStatisticsState } from '../../../src/feed/statistics/state-store';
import { makeSourceItem } from '../../helpers/translation-fixtures';

const source = 'https://example.com/jvn.rss';
const otherSource = 'https://example.com/security.rss';
const sections = (moved: boolean): StatisticsSection[] => [
  {
    id: 'security',
    title: 'セキュリティ',
    feedInfoList: moved ? [{ url: otherSource }] : [{ url: otherSource }, { url: source }],
  },
  { id: 'jvn', title: 'JVN', feedInfoList: moved ? [{ url: source }] : [] },
];
const initialDate = new Date('2026-09-28T10:00:00.000Z');
const nextDay = new Date('2026-09-28T15:00:00.000Z');
const article = (sectionId: string, sourceFeedUrl?: string) =>
  makeSourceItem({ sectionId, sourceFeedUrl, isoDate: '2026-09-28T01:00:00.000Z' });

describe('取得元のカテゴリ変更', () => {
  it('再取得できない保存記事も現在のRSS所属へ移し、元の日時とIDを保持する', () => {
    const first = updateStatistics(null, [article('security', source)], sections(false), initialDate);
    const published = updateStatistics(first, [], sections(false), nextDay);
    const before = structuredClone(published);
    const result = updateStatistics(published, [], sections(true), new Date('2026-09-28T16:00:00.000Z'));
    expect(result.observations).toEqual([{ ...first.observations[0], sectionId: 'jvn', sectionTitle: 'JVN' }]);
    expect(result.reports[0]).toMatchObject({
      date: published.reports[0].date,
      publishedAt: published.reports[0].publishedAt,
      categories: [
        { sectionId: 'jvn', title: 'JVN', count: 1 },
        { sectionId: 'security', title: 'セキュリティ', count: 0 },
      ],
    });
    expect(published).toEqual(before);
    expect(updateStatistics(result, [], sections(true), new Date('2026-09-28T17:00:00.000Z')).reports).toEqual(
      result.reports,
    );
  });

  it('取得元がない旧形式の二重履歴を照合し、特定できない別記事は保持する', () => {
    const first = updateStatistics(
      null,
      [article('security'), article('jvn'), { ...article('security'), link: 'https://example.com/old-only' }],
      sections(true),
      initialDate,
    );
    const old = parseStatisticsState(
      JSON.stringify({
        ...first,
        schemaVersion: 1,
        observations: first.observations.map((item) => ({
          articleId: item.articleId,
          sectionId: item.sectionId,
          sectionTitle: item.sectionTitle,
          publishedAt: item.publishedAt,
        })),
      }),
    );
    const result = updateStatistics(
      old,
      [{ ...article('jvn', source), isoDate: '2026-09-28T14:00:00.000Z' }],
      sections(true),
      nextDay,
    );
    expect(result.schemaVersion).toBe(3);
    expect(result.observations).toHaveLength(2);
    expect(result.observations.find((item) => item.sectionId === 'jvn')?.publishedAt).toBe('2026-09-28T01:00:00.000Z');
    expect(result.reports[0].categories.map(({ sectionId, count }) => [sectionId, count])).toEqual([
      ['jvn', 1],
      ['security', 1],
    ]);
  });

  it('同じ記事を別RSSでも取得した場合、カテゴリ移動を理由に正当な掲載を消さない', () => {
    const first = updateStatistics(
      null,
      [article('security', source), article('security', otherSource)],
      sections(false),
      initialDate,
    );
    expect(first.observations).toHaveLength(2);
    const before = updateStatistics(first, [], sections(false), nextDay);
    expect(before.reports[0].categories.find((category) => category.sectionId === 'security')?.count).toBe(1);
    const moved = updateStatistics(before, [], sections(true), new Date('2026-09-28T16:00:00.000Z'));
    expect(moved.reports[0].categories.map(({ sectionId, count }) => [sectionId, count])).toEqual([
      ['jvn', 1],
      ['security', 1],
    ]);
    expect(parseStatisticsState(JSON.stringify(moved))).toEqual(moved);
  });

  it('取得元の定義がなくなっても有効な保存履歴を削除しない', () => {
    const first = updateStatistics(null, [article('security', source)], sections(false), initialDate);
    const result = updateStatistics(first, [], [], nextDay);
    expect(result.observations).toEqual(first.observations);
    expect(result.reports[0].categories).toMatchObject([{ sectionId: 'security', title: 'セキュリティ', count: 1 }]);
  });
});
