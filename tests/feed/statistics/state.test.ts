import { describe, expect, it } from 'vitest';
import { updateStatistics } from '../../../src/feed/statistics/aggregate';
import { parseStatisticsDefinition } from '../../../src/feed/statistics/config';
import { parseStatisticsState } from '../../../src/feed/statistics/state-store';
import { makeSourceItem } from '../../helpers/translation-fixtures';

const valid = () =>
  updateStatistics(
    null,
    [makeSourceItem({ isoDate: '2026-09-27T00:00:00.000Z' })],
    [{ id: 'ai', title: 'AI' }],
    new Date('2026-09-27T01:00:00.000Z'),
  );

it('保存履歴の未知の情報を公開出力へ引き継がない', () => {
  const state = valid();
  const result = parseStatisticsState(
    JSON.stringify({
      ...state,
      privateField: 'private',
      observations: state.observations.map((item) => ({ ...item, url: 'private' })),
    }),
  );
  expect(JSON.stringify(result)).not.toContain('private');
});

it('記事・日付の重複と不正な日時を拒否する', () => {
  const state = valid();
  for (const malformed of [
    { ...state, observations: [...state.observations, ...state.observations] },
    { ...state, collectionDays: ['2026-09-27', '2026-09-27'] },
    { ...state, startedAt: '2026-10-01T00:00:00.000Z' },
    { ...state, observations: [{ ...state.observations[0], sectionId: '../escape' }] },
    { ...state, observations: [{ ...state.observations[0], publishedAt: '2026-02-30T00:00:00.000Z' }] },
  ])
    expect(() => parseStatisticsState(JSON.stringify(malformed))).toThrow();
});

describe('日次統計JSON定義', () => {
  const config = { schemaVersion: 1, title: '日次統計', timeZone: 'Asia/Tokyo', retentionDays: 90 };
  it('日本時間と保持日数を読み込む', () => {
    expect(parseStatisticsDefinition(config)).toEqual(config);
  });
  it.each([
    { timeZone: 'UTC' },
    { retentionDays: 0 },
    { retentionDays: 366 },
    { retentionDays: 1.5 },
    { title: '' },
    { unexpected: true },
  ])('不正な設定を拒否する: %o', (override) => {
    expect(() => parseStatisticsDefinition({ ...config, ...override })).toThrow();
  });
});
