import { describe, expect, it } from 'vitest';
import { updateStatistics } from '../../../src/feed/statistics/aggregate';
import { dayStart, isDay, jstDay, shiftDay } from '../../../src/feed/statistics/dates';
import { buildStatisticsFeed } from '../../../src/feed/statistics/feed-builder';
import { makeSourceItem } from '../../helpers/translation-fixtures';

const sections = [
  { id: 'ai', title: 'AI' },
  { id: 'aws', title: 'AWS' },
];
const article = (url: string, isoDate: string, sectionId = 'ai') => makeSourceItem({ link: url, isoDate, sectionId });
const initial = () => updateStatistics(null, [], sections, new Date('2026-09-27T00:00:00.000Z'));

describe('日次統計の集計', () => {
  it('カテゴリ名の変更を保存済み統計へ反映し、記事数・所属・公開日時を保持する', () => {
    const first = updateStatistics(
      initial(),
      [article('https://example.com/article', '2026-09-27T01:00:00.000Z')],
      sections,
      new Date('2026-09-27T15:00:00.000Z'),
    );
    const before = structuredClone(first);
    const renamed = [{ id: 'ai', title: 'AI 公式ブログ' }];
    const result = updateStatistics(first, [], renamed, new Date('2026-09-27T16:00:00.000Z'));
    expect(result.observations).toEqual([{ ...first.observations[0], sectionTitle: 'AI 公式ブログ' }]);
    expect(result.reports[0]).toMatchObject({
      ...first.reports[0],
      updatedAt: '2026-09-27T16:00:00.000Z',
      categories: [{ sectionId: 'ai', title: 'AI 公式ブログ', count: 1 }],
    });
    expect(first).toEqual(before);
    expect(updateStatistics(result, [], renamed, new Date('2026-09-27T17:00:00.000Z')).reports).toEqual(result.reports);
  });

  it('初回は当日分を収集し、JSTの日付境界で前日分だけ配信する', () => {
    const items = [
      article('https://example.com/before', '2026-09-26T14:59:59.999Z'),
      article('https://example.com/start', '2026-09-26T15:00:00.000Z'),
      article('https://example.com/end', '2026-09-27T14:59:59.999Z'),
    ];
    const before = updateStatistics(initial(), items, sections, new Date('2026-09-27T14:59:59.999Z'));
    expect(before.reports).toEqual([]);
    expect(before.observations).toHaveLength(2);
    const after = updateStatistics(
      before,
      [article('https://example.com/today', '2026-09-27T15:00:00.000Z')],
      sections,
      new Date('2026-09-27T15:00:00.000Z'),
    );
    expect(after.reports).toHaveLength(1);
    expect(after.reports[0]).toMatchObject({
      date: '2026-09-27',
      coverage: 'partial',
      categories: [
        { sectionId: 'ai', title: 'AI', count: 2 },
        { sectionId: 'aws', title: 'AWS', count: 0 },
      ],
    });
    expect(after.observations).toHaveLength(3);
  });

  it('巡回中に消えた記事も保持し、UTM違い・再取得・翻訳を重複加算しない', () => {
    const item = article('https://example.com/article', '2026-09-27T01:00:00.000Z');
    const first = updateStatistics(initial(), [item], sections, new Date('2026-09-27T02:00:00.000Z'));
    const result = updateStatistics(
      first,
      [
        { ...item, link: `${item.link}?utm_source=test` },
        { ...item, sectionId: 'ai-jp' },
        { ...item, sectionId: 'aws' },
        article('https://example.com/second', '2026-09-27T03:00:00.000Z'),
      ],
      sections,
      new Date('2026-09-27T15:00:00.000Z'),
    );
    expect(result.reports[0].categories).toMatchObject([
      { sectionId: 'ai', title: 'AI', count: 2 },
      { sectionId: 'aws', title: 'AWS', count: 1 },
    ]);
    const again = updateStatistics(result, [], sections, new Date('2026-09-27T16:00:00.000Z'));
    expect(again.reports).toEqual(result.reports);
    expect(buildStatisticsFeed(again)).toEqual(buildStatisticsFeed(result));
  });

  it('元記事の日時更新では計上日を移動せず、遅延取得は同じ日次記事を更新する', () => {
    const item = article('https://example.com/article', '2026-09-27T01:00:00.000Z');
    const first = updateStatistics(initial(), [item], sections, new Date('2026-09-27T15:00:00.000Z'));
    const late = updateStatistics(
      first,
      [
        { ...item, isoDate: '2026-09-28T01:00:00.000Z' },
        article('https://example.com/late', '2026-09-27T02:00:00.000Z'),
      ],
      sections,
      new Date('2026-09-28T02:00:00.000Z'),
    );
    expect(late.reports).toHaveLength(1);
    expect(late.reports[0].date).toBe(first.reports[0].date);
    expect(late.reports[0].publishedAt).toBe(first.reports[0].publishedAt);
    expect(late.reports[0].updatedAt).not.toBe(first.reports[0].updatedAt);
    expect(late.reports[0].categories[0].count).toBe(2);
  });

  it('欠けた日を補完し、巡回記録のない日を区別する', () => {
    const result = updateStatistics(
      initial(),
      [article('https://example.com/late', '2026-09-28T00:00:00.000Z')],
      sections,
      new Date('2026-09-30T00:00:00.000Z'),
    );
    expect(result.reports.map((report) => report.date)).toEqual(['2026-09-29', '2026-09-28', '2026-09-27']);
    expect(result.reports[0]).toMatchObject({ coverage: 'unobserved', categories: [{ count: 0 }, { count: 0 }] });
    expect(result.reports[1]).toMatchObject({ coverage: 'unobserved', categories: [{ count: 1 }, { count: 0 }] });
  });

  it('同一実行内の入力順に依存せず、重複URLの最も早い日時を採用する', () => {
    const items = [
      article('https://example.com/a', '2026-09-27T02:00:00.000Z'),
      article('https://example.com/a', '2026-09-27T01:00:00.000Z'),
    ];
    const now = new Date('2026-09-27T15:00:00.000Z');
    expect(updateStatistics(initial(), items, sections, now)).toEqual(
      updateStatistics(initial(), [...items].reverse(), sections, now),
    );
  });

  it('不正・未来・日時なし・認証情報付きの記事は記録しない', () => {
    const result = updateStatistics(
      initial(),
      [
        article('https://example.com/a', ''),
        article('https://example.com/a', 'invalid'),
        article('https://example.com/a', '2026-09-28T00:00:00.000Z'),
        article('javascript:alert(1)', '2026-09-27T01:00:00.000Z'),
        article('https://example.com/a?access_token=private', '2026-09-27T01:00:00.000Z'),
      ],
      sections,
      new Date('2026-09-27T02:00:00.000Z'),
    );
    expect(result.observations).toEqual([]);
  });

  it('履歴は保持期間内に限定し、開始前の架空の日次記事を作らない', () => {
    const first = updateStatistics(null, [], sections, new Date('2026-01-01T00:00:00.000Z'));
    const later = updateStatistics(first, [], sections, new Date('2026-04-15T00:00:00.000Z'));
    expect(later.reports).toHaveLength(90);
    expect(later.reports.at(-1)?.date).toBe('2026-01-15');
    expect(later.collectionDays).toEqual(['2026-04-15']);
    expect(() => updateStatistics(later, [], sections, new Date('2026-01-01T00:00:00.000Z'))).toThrow('前の時刻');
  });
});

describe('日本時間の暦日', () => {
  it('UTC日付と月末・うるう年を区別する', () => {
    expect(jstDay('2026-09-27T15:00:00.000Z')).toBe('2026-09-28');
    expect(dayStart('2026-09-28')).toBe('2026-09-27T15:00:00.000Z');
    expect(shiftDay('2026-01-31', 1)).toBe('2026-02-01');
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2024-02-29')).toBe(true);
  });
});
