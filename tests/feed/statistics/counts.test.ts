import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { updateStatistics } from '../../../src/feed/statistics/aggregate';
import type { StatisticsSection } from '../../../src/feed/statistics/observations';
import { renderDailyReport } from '../../../src/feed/statistics/presentation';
import { parseStatisticsState } from '../../../src/feed/statistics/state-store';
import { collectTranslatedStatisticsItems } from '../../../src/feed/statistics/translated-items';
import type { TranslatedFeedDefinition } from '../../../src/resources/translated-feed-list';
import { renderStatisticsReport } from '../../../src/site/_includes/components/statistics-report';
import { makeSourceItem } from '../../helpers/translation-fixtures';

const sections: StatisticsSection[] = [
  {
    id: 'ai',
    title: 'AI',
    feedInfoList: [
      { url: 'https://example.com/en/rss', label: '英語RSS', language: 'en' },
      {
        url: 'https://example.com/generated/rss',
        label: '独自RSS',
        language: 'en',
        input: { kind: 'generated', id: 'generated' },
      },
      { url: 'https://example.com/ja/rss', label: '日本語RSS', language: 'ja' },
      { url: 'https://example.com/empty/rss', label: '空のRSS', language: 'en' },
    ],
  },
];
const definitions: TranslatedFeedDefinition[] = [
  {
    id: 'ai-jp',
    title: 'AI - Translated Japanese',
    sourceSectionId: 'ai',
    sourceLanguage: 'en',
    targetLanguage: 'ja',
  },
];
const article = (sourceFeedUrl: string, link = 'https://example.com/article') =>
  makeSourceItem({
    sourceFeedUrl,
    link,
    isoDate: '2026-09-28T01:00:00.000Z',
  });
const items = [
  article('https://example.com/en/rss'),
  article('https://example.com/generated/rss'),
  { ...article('https://example.com/ja/rss', 'https://example.com/japanese'), sourceLanguage: 'ja' as const },
];
const start = new Date('2026-09-28T10:00:00.000Z');
const midnight = new Date('2026-09-28T15:00:00.000Z');

describe('カテゴリと取得元の内訳', () => {
  it('原文と翻訳が各1件でも、同じ記事を総数2件として表示しない', () => {
    const initial = updateStatistics(null, [items[0]], sections, start, definitions, [items[0]]);
    const state = updateStatistics(initial, [], sections, midnight, definitions);
    const rss = load(renderDailyReport(state.reports[0]));
    expect(rss.text()).toContain('AI：1件（en 1件 / translated-jp 1件）');
  });

  it('通常・独自生成・翻訳と0件を網羅し、同じ記事のRSS間の重複を区別する', () => {
    const source = updateStatistics(null, items, sections, start, definitions, items.slice(0, 2));
    const state = updateStatistics(source, [], sections, midnight, definitions);
    const report = state.reports[0];
    const normal = report.categories.find((category) => category.sectionId === 'ai');
    const translated = report.categories.find((category) => category.sectionId === 'ai-jp');
    expect(normal?.count).toBe(2);
    expect(normal?.englishCount).toBe(1);
    expect(normal?.feeds).toHaveLength(4);
    expect(normal?.feeds.reduce((sum, feed) => sum + feed.count, 0)).toBe(3);
    expect(normal?.feeds.find((feed) => feed.kind === 'generated')).toMatchObject({ title: '独自RSS', count: 1 });
    expect(normal?.feeds.find((feed) => feed.title === '空のRSS')?.count).toBe(0);
    expect(translated?.count).toBe(1);
    expect(translated?.feeds).toHaveLength(3);
    expect(translated?.feeds.some((feed) => feed.title === '日本語RSS')).toBe(false);
    const html = load(renderStatisticsReport(report));
    expect(html('details > summary')).toHaveLength(1);
    expect(html('.ui-statistics-inline-breakdown').text()).toBe('（en 1件 / translated-jp 1件）');
    expect(html('.ui-statistics-metrics dd').eq(0).text()).toBe('2件');
    expect(html('.ui-statistics-metrics dd').eq(1).text()).toBe('1件');
    expect(html('a[href="https://example.com/generated/rss"]')).toHaveLength(2);
    const rssBody = load(renderDailyReport(report));
    expect(rssBody('li > ul')).toHaveLength(0);
    expect(rssBody.text()).toContain('AI：2件（en 1件 / translated-jp 1件）');
    expect(parseStatisticsState(JSON.stringify(state))).toEqual(state);
  });

  it('翻訳対象でも出力を確認できなければ翻訳件数に含めず、後から確認した掲載を保持する', () => {
    const first = updateStatistics(null, items, sections, start, definitions);
    const ungenerated = updateStatistics(first, [], sections, midnight, definitions);
    expect(ungenerated.reports[0].categories.find((category) => category.kind === 'translated')?.count).toBe(0);
    const published = updateStatistics(ungenerated, [], sections, new Date('2026-09-28T16:00:00.000Z'), definitions, [
      items[0],
    ]);
    expect(published.reports[0].categories.find((category) => category.kind === 'translated')?.count).toBe(1);
    const restored = parseStatisticsState(JSON.stringify(published));
    expect(updateStatistics(restored, [], sections, new Date('2026-09-28T17:00:00.000Z'), definitions).reports).toEqual(
      published.reports,
    );
  });

  it('同一実行の出力JSONにない記事と日本語ソースは翻訳掲載履歴へ含めない', () => {
    const feeds = new Map([
      ['ai-jp', { rss: '', atom: '', json: JSON.stringify({ items: [{ url: items[0].link }] }) }],
    ]);
    const extra = article('https://example.com/en/rss', 'https://example.com/not-published');
    expect(collectTranslatedStatisticsItems([...items, extra], definitions, feeds)).toEqual(items.slice(0, 2));
    expect(collectTranslatedStatisticsItems(items, definitions, new Map())).toEqual([]);
  });

  it('保存済み内訳の不正URLと負の件数を拒否する', () => {
    const initial = updateStatistics(null, items, sections, start, definitions);
    const state = updateStatistics(initial, [], sections, midnight, definitions);
    for (const url of ['javascript:alert(1)', 'https://example.com/rss?access_token=secret']) {
      const invalid = structuredClone(state);
      invalid.reports[0].categories[0].feeds[0].url = url;
      expect(() => parseStatisticsState(JSON.stringify(invalid))).toThrow('不正');
    }
    const invalid = structuredClone(state);
    invalid.reports[0].categories[0].feeds[0].count = -1;
    expect(() => parseStatisticsState(JSON.stringify(invalid))).toThrow('不正');
  });

  it('取得元不明の履歴を特定のRSSへ割り振らず内訳に残す', () => {
    const first = updateStatistics(null, [makeSourceItem({ isoDate: items[0].isoDate })], sections, start, definitions);
    const state = updateStatistics(first, [], sections, midnight, definitions);
    expect(state.reports[0].categories[0].feeds.find((feed) => feed.kind === 'unresolved')).toMatchObject({
      url: null,
      count: 1,
    });
  });
});
