import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { create as createCache } from 'flat-cache';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import constants from '../src/common/constants';
import { publicNetworkDispatcher } from '../src/common/url-guard';
import { textToMd5Hash } from '../src/feed/common-util';
import { type CustomRssParserFeed, FeedCrawler } from '../src/feed/feed-crawler';
import { logger } from '../src/feed/logger';
import type { FeedInfo } from '../src/resources/feed-info-list';

const location = vi.hoisted(() => ({ directory: '' }));
vi.mock('flat-cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('flat-cache')>();
  return {
    ...actual,
    create: (options: Parameters<typeof actual.create>[0]) =>
      actual.create({ ...options, cacheDir: location.directory }),
  };
});
const info: FeedInfo = {
  label: 'Source',
  url: 'https://example.com/rss',
  sectionId: 'hacker-news',
  language: 'en',
  input: { kind: 'remote', url: 'https://example.com/rss' },
};
const now = new Date('2026-09-29T12:11:34.000Z');
const xml = (id: string, summary = '概要'): string =>
  `<rss version="2.0"><channel><title>Source</title><link>https://example.com/</link><description>Source</description><item><title>${id}</title><link>https://example.com/${id}</link><guid>${id}</guid><description>${summary}</description></item></channel></rss>`;
const fetchSource = (crawler = new FeedCrawler()): Promise<CustomRssParserFeed> =>
  (crawler as unknown as { fetchSourceFeed(info: FeedInfo): Promise<CustomRssParserFeed> }).fetchSourceFeed(info);
const key = (): string => `feed-${constants.fetchedFeedCacheDurationInMinutes}m-${textToMd5Hash(info.url)}`;

beforeEach(async () => {
  location.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rss-cache-test-'));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await fs.rm(location.directory, { recursive: true, force: true });
});

it('短時間はキャッシュを使い、前回から1時間未満の定期巡回でも更新を取得する', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(xml('old')))
    .mockResolvedValueOnce(new Response(xml('new')));
  expect((await fetchSource()).items[0].title).toBe('old');
  vi.setSystemTime(new Date(now.getTime() + 5 * 60_000));
  expect((await fetchSource()).items[0].title).toBe('old');
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.setSystemTime(new Date(now.getTime() + 59 * 60_000 + 24_000));
  expect((await fetchSource()).items[0].title).toBe('new');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledWith(info.url, expect.objectContaining({ dispatcher: publicNetworkDispatcher }));
});

it('有効時間が異なるキャッシュを流用せず、その場で再取得する', async () => {
  const legacyKey = `feed-${textToMd5Hash(info.url)}`;
  const previous = createCache({ cacheId: legacyKey, ttl: 3_600_000 });
  previous.set(legacyKey, xml('old'));
  previous.save();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(xml('new')));
  expect((await fetchSource()).items[0].title).toBe('new');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('壊れたXMLキャッシュから正常な取得結果へ復旧する', async () => {
  const cache = createCache({ cacheId: key(), ttl: 900_000 });
  cache.set(key(), '<rss><broken>');
  cache.save();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(xml('new')));
  expect((await fetchSource()).items[0].title).toBe('new');
  expect((await fetchSource()).items[0].title).toBe('new');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith('[fetch-feed] invalid-cache', { label: 'Source' });
});

it('破損概要を除いたXMLを保存し、キャッシュからも同じ記事を取得できる', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(xml('pdf', 'PDF\u007F\uFFFD')));
  const first = await fetchSource();
  const second = await fetchSource();
  expect(first.items).toHaveLength(1);
  expect(second.items).toEqual(first.items);
  expect(first.items[0].contentSnippet ?? '').toBe('');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledTimes(1);
});

it('期限切れキャッシュと取得失敗を新着として扱わず、失敗内容も保存しない', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(xml('old')))
    .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
    .mockResolvedValueOnce(new Response(xml('new')));
  await fetchSource();
  vi.setSystemTime(new Date(now.getTime() + 16 * 60_000));
  await expect(fetchSource()).rejects.toThrow('HTTP Error: 503');
  expect((await fetchSource()).items[0].title).toBe('new');
});

it('構造が壊れたHTTP応答はキャッシュへ保存しない', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response('<rss><item>'))
    .mockResolvedValueOnce(new Response(xml('new')));
  await expect(fetchSource()).rejects.toThrow();
  expect((await fetchSource()).items[0].title).toBe('new');
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('内部生成フィードの制御文字を外部入力の補正で隠さない', async () => {
  const crawler = new FeedCrawler(new Map([['bad', xml('bad', '概要\u007F')]]));
  const source = { ...info, input: { kind: 'generated' as const, id: 'bad' } };
  await expect(
    (crawler as unknown as { fetchSourceFeed(info: FeedInfo): Promise<CustomRssParserFeed> }).fetchSourceFeed(source),
  ).rejects.toThrow('制御文字');
});
