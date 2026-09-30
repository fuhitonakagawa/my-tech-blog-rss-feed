import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { create as createCache } from 'flat-cache';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CustomRssParserFeed } from '../../src/feed/feed-crawler';
import { QiitaSupplement, qiitaTag } from '../../src/feed/qiita-supplement';

const location = vi.hoisted(() => ({ directory: '' }));
vi.mock('flat-cache', async (original) => {
  const actual = await original<typeof import('flat-cache')>();
  return {
    ...actual,
    create: (options: Parameters<typeof actual.create>[0]) =>
      actual.create({ ...options, cacheDir: location.directory }),
  };
});
const apiItem = (index: number) => ({
  id: index.toString(16).padStart(20, '0'),
  url: `https://qiita.com/example/items/${index.toString(16).padStart(20, '0')}`,
  title: `記事${index}`,
  created_at: '2026-09-30T06:00:00+09:00',
  rendered_body: '<p>公開された概要😀</p>',
  tags: [{ name: 'AI' }],
  user: { id: 'example' },
  private: false,
});
const feed = (): CustomRssParserFeed => ({
  title: 'Qiita AI',
  link: 'https://qiita.com/tags/ai',
  sectionId: 'qiita-ai',
  items: [],
});
beforeEach(async () => {
  location.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiita-supplement-'));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime('2026-09-30T12:00:00Z');
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await fs.rm(location.directory, { recursive: true, force: true });
});

it('タグRSSだけを対象とし、外部ホスト・人気・企業フィードには適用しない', () => {
  expect(qiitaTag('https://qiita.com/tags/%E7%94%9F%E6%88%90ai/feed')).toBe('生成ai');
  for (const url of [
    'https://other.example/tags/ai/feed',
    'https://qiita.com/popular-items/feed',
    'https://qiita.com/organizations/example/activities.atom',
    'https://qiita.com/tags/a%20OR%20b/feed',
  ])
    expect(qiitaTag(url)).toBeUndefined();
});

it('100件ごとに続きも取得し、RSSと重複する記事は増やさず期間内の記事を補う', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 100 }, (_, i) => apiItem(i)))))
    .mockResolvedValueOnce(new Response(JSON.stringify([apiItem(100)])));
  const result = feed();
  const first = apiItem(0);
  result.items.push({
    title: 'RSSのタイトル',
    link: first.url,
    guid: 'rss-guid',
    isoDate: '2026-09-29T21:00:00.000Z',
    blogTitle: result.title,
    blogLink: result.link,
    sectionId: result.sectionId,
    sourceLanguage: 'unknown',
  });
  await new QiitaSupplement().enrich(result, 'https://qiita.com/tags/ai/feed');
  expect(result.items).toHaveLength(101);
  expect(result.items[0].guid).toBe('rss-guid');
  expect(result.items.find((i) => i.link === apiItem(100).url)).toMatchObject({
    isoDate: '2026-09-29T21:00:00.000Z',
    sourceFeedUrl: 'https://qiita.com/tags/ai/feed',
    summary: '公開された概要😀',
  });
  expect(new URL(String(fetch.mock.calls[1][0])).searchParams.get('page')).toBe('2');
  expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get('query')).toBe('tag:ai created:>=2026-09-22');
  const cached = feed();
  await new QiitaSupplement().enrich(cached, 'https://qiita.com/tags/ai/feed');
  expect(cached.items).toHaveLength(101);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('公開条件を満たさない記事を隔離し、API失敗でも保存済み記事とRSSを保持する', async () => {
  const bad = [
    { ...apiItem(2), private: true },
    { ...apiItem(3), created_at: '2026-01-01' },
    { ...apiItem(4), tags: [{ name: 'Ruby' }] },
    { ...apiItem(5), url: 'http://127.0.0.1/secret' },
    { ...apiItem(6), created_at: '2026-10-01' },
  ];
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify([apiItem(1), ...bad])));
  const first = feed();
  await new QiitaSupplement().enrich(first, 'https://qiita.com/tags/ai/feed');
  expect(first.items).toHaveLength(1);
  vi.setSystemTime('2026-09-30T13:00:00Z');
  fetch.mockResolvedValueOnce(new Response('', { status: 429 }));
  const second = feed();
  await new QiitaSupplement().enrich(second, 'https://qiita.com/tags/ai/feed');
  expect(second.items).toEqual(first.items);
  vi.setSystemTime('2026-10-10T13:00:00Z');
  fetch.mockResolvedValueOnce(new Response('[]'));
  const expired = feed();
  await new QiitaSupplement().enrich(expired, 'https://qiita.com/tags/ai/feed');
  expect(expired.items).toEqual([]);
});

it('複数タグの補完全体で匿名APIの取得予算を守る', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    vi.setSystemTime(Date.now() + 1000);
    return new Response('[]');
  });
  const supplement = new QiitaSupplement();
  for (let index = 0; index < 46; index++) await supplement.enrich(feed(), `https://qiita.com/tags/topic${index}/feed`);
  expect(fetch).toHaveBeenCalledTimes(45);
});

it('取得済み日時が新しくても破損した補完キャッシュを完全な結果として使わない', async () => {
  const url = 'https://qiita.com/tags/ai/feed';
  const key = createHash('sha256').update(url).digest('hex');
  const cache = createCache({ cacheId: `qiita-supplement-v1-${key}`, ttl: 14 * 86400_000 });
  cache.set('articles', [{ id: 'broken' }]);
  cache.set('checkedAt', new Date().toISOString());
  cache.save();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([apiItem(1)])));
  const result = feed();
  await new QiitaSupplement().enrich(result, url);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.items).toHaveLength(1);
});
