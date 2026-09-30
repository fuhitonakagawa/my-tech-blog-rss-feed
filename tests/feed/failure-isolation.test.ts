import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import ogs from 'open-graph-scraper';
import Parser from 'rss-parser';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { sectionFeedUrls, sectionPageUrl } from '../../src/common/constants';
import { type CustomOgObject, type CustomRssParserItem, FeedCrawler } from '../../src/feed/feed-crawler';
import { FeedGenerator } from '../../src/feed/feed-generator';
import { FeedValidator } from '../../src/feed/feed-validator';
import { logger } from '../../src/feed/logger';
import { generateSlackFeeds } from '../../src/feed/slack/service';
import { parseSlackState } from '../../src/feed/slack/state-store';
import { generateTranslatedFeeds } from '../../src/feed/translation/translated-feed-generator';
import type { FeedInfo } from '../../src/resources/feed-info-list';
import type { TranslatedFeedDefinition } from '../../src/resources/translated-feed-list';
import { makeSourceItem } from '../helpers/translation-fixtures';

const location = vi.hoisted(() => ({ directory: '' }));
vi.mock('flat-cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('flat-cache')>();
  return {
    ...actual,
    create: (options: Parameters<typeof actual.create>[0]) =>
      actual.create({ ...options, cacheDir: location.directory }),
  };
});
const definition: TranslatedFeedDefinition = {
  id: 'ai-jp',
  title: 'AI - Translated Japanese',
  sourceSectionId: 'ai',
  sourceLanguage: 'en',
  targetLanguage: 'ja',
};
const now = new Date('2026-09-30T03:00:00.000Z');
const info = (id: string): FeedInfo => ({
  label: id,
  url: `https://example.com/${id}/rss`,
  sectionId: 'ai',
  language: 'en',
  input: { kind: 'remote', url: `https://example.com/${id}/rss` },
});
const xml = (id: string, guid: string): string => `<rss version="2.0"><channel>
  <title>${id}</title><link>https://example.com/${id}/</link><description>Source</description>
  <item><title>${id}</title><link>https://example.com/${id}/article</link><guid>${guid}</guid>
  <pubDate>Tue, 29 Sep 2026 10:00:00 GMT</pubDate><description>Summary</description>
  <category>${'tag'.repeat(667)}</category></item></channel></rss>`;

beforeEach(async () => {
  location.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'feed-isolation-'));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await fs.rm(location.directory, { recursive: true, force: true });
});

it('画像0件でも通常・翻訳・通知RSSを配信できる', async () => {
  const items = [makeSourceItem()];
  const original = new FeedGenerator().generateFeeds(items, new Map(), new Map(), 200, 500, {
    title: 'AI',
    description: 'AI',
    pageUrl: sectionPageUrl('ai'),
    feedUrls: sectionFeedUrls('ai'),
  }).feedDistributionSet;
  const translated = await generateTranslatedFeeds(items, [definition], new Map(), new Map(), () => ({
    translateItems: async (source) =>
      source.map((item) => ({ ...item, originalTitle: item.title, title: '日本語の記事' })),
  }));
  const sources = [];
  for (const [id, distribution] of [['ai', original], ...translated] as const) {
    const validator = new FeedValidator();
    const rss = await validator.assertXmlFeed('rss', distribution.rss);
    await validator.assertXmlFeed('atom', distribution.atom);
    expect(rss.items.map((item) => item.link)).toEqual(['https://example.com/article']);
    expect(rss.items[0].enclosure).toBeUndefined();
    sources.push({
      rssUrl: sectionFeedUrls(id).rss,
      rssPath: `${id === 'ai' ? 'section-feeds' : 'translated-feeds'}/${id}/feeds/rss.xml`,
      json: distribution.json,
    });
  }
  const state = await generateSlackFeeds(
    sources,
    path.join(location.directory, 'published'),
    path.join(location.directory, 'output'),
    now,
  );
  expect(Object.values(state.feeds).map((feed) => feed.items[0].image)).toEqual([null, null]);
});

it.each([1, 3])(
  '異常RSS・長いGUID・タグ・OGP制御文字があっても正常記事を通知まで配信する: 並列数%d',
  async (concurrency) => {
    const input = [info('before'), info('http-error'), info('xml-error'), info('long-guid'), info('after')];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const id = new URL(String(url)).pathname.split('/')[1];
      if (id === 'http-error') return new Response('Unavailable', { status: 503 });
      if (id === 'xml-error') return new Response('<rss><channel><item></channel>');
      return new Response(xml(id, id === 'long-guid' ? 'x'.repeat(8193) : id === 'before' ? 'x'.repeat(8192) : id));
    });
    const { result: rawOg } = await ogs({
      html: '<html><head><meta property="og:image" content="https://example.com/image.png"><meta property="og:image:alt" content="画像&#127;説明"></head></html>',
    });
    const staticCrawler = FeedCrawler as unknown as {
      fetchOgObject(url: string): Promise<CustomOgObject>;
      normalizeOgObject(url: string, object: CustomOgObject): CustomOgObject;
    };
    const og = staticCrawler.normalizeOgObject('https://example.com/', rawOg);
    expect(og.customOgImage?.alt).toContain('\u007F');
    vi.spyOn(staticCrawler, 'fetchOgObject').mockResolvedValue(og);
    const crawler = new FeedCrawler();
    vi.spyOn(
      crawler as unknown as {
        fetchHatenaCountMap(items: CustomRssParserItem[]): Promise<Map<string, number>>;
      },
      'fetchHatenaCountMap',
    ).mockResolvedValue(new Map());
    const result = await crawler.crawlFeeds(input, concurrency, concurrency, new Date('2026-09-22T00:00:00.000Z'));
    expect(result.feedItems.map((item) => item.title).sort()).toEqual(['after', 'before', 'long-guid']);
    const original = new FeedGenerator().generateFeeds(
      result.feedItems,
      result.feedItemOgObjectMap,
      new Map(),
      200,
      500,
      {
        title: 'AI',
        description: 'AI',
        pageUrl: sectionPageUrl('ai'),
        feedUrls: sectionFeedUrls('ai'),
      },
    );
    const translated = await generateTranslatedFeeds(
      result.feedItems,
      [definition],
      result.feedItemOgObjectMap,
      new Map(),
      () => ({
        translateItems: async (items) =>
          items.map((item) => ({ ...item, originalTitle: item.title, title: `翻訳:${item.title}` })),
      }),
    );
    const sources = [];
    const validator = new FeedValidator();
    for (const [id, distribution] of [['ai', original.feedDistributionSet], ...translated] as const) {
      for (const format of ['rss', 'atom'] as const) {
        const parsed = await validator.assertXmlFeed(format, distribution[format]);
        expect(parsed.items.map((item) => item.link).sort()).toEqual([
          'https://example.com/after/article',
          'https://example.com/before/article',
        ]);
      }
      expect(distribution.rss).toContain('alt="画像説明"');
      sources.push({
        rssUrl: sectionFeedUrls(id).rss,
        rssPath: `${id === 'ai' ? 'section-feeds' : 'translated-feeds'}/${id}/feeds/rss.xml`,
        json: distribution.json,
      });
    }
    const output = path.join(location.directory, 'output');
    const state = await generateSlackFeeds(sources, path.join(location.directory, 'published'), output, now);
    expect(parseSlackState(JSON.stringify(state))).toEqual(state);
    for (const source of sources) {
      const published = await new Parser().parseString(await fs.readFile(path.join(output, source.rssPath), 'utf8'));
      expect(published.items.map((item) => item.link).sort()).toEqual([
        'https://example.com/after/article',
        'https://example.com/before/article',
      ]);
      expect(published.items.find((item) => item.link?.includes('/before/'))?.guid).toBe('x'.repeat(8192));
      expect(published.items.every((item) => item.categories?.[0]?.length === 2000)).toBe(true);
    }
    expect(logger.warn).toHaveBeenCalledWith('[feed-item] identifier-too-long', { length: 8193 });
  },
);
