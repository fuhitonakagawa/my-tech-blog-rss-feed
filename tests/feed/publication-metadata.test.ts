import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CustomRssParserFeed } from '../../src/feed/feed-crawler';
import {
  fillPublicationDates,
  parsePublicationDate,
  publicationDateFromHtml,
} from '../../src/feed/publication-metadata';
import { makeSourceItem } from '../helpers/translation-fixtures';

const location = vi.hoisted(() => ({ directory: '' }));
const htmlResponse = (date: string, url = 'https://example.com/article'): Response => {
  const response = new Response(`<meta property="article:published_time" content="${date}">`, {
    headers: { 'content-type': 'text/html' },
  });
  Object.defineProperty(response, 'url', { value: url });
  return response;
};
vi.mock('flat-cache', async (original) => {
  const actual = await original<typeof import('flat-cache')>();
  return {
    ...actual,
    create: (options: Parameters<typeof actual.create>[0]) =>
      actual.create({ ...options, cacheDir: location.directory }),
  };
});
beforeEach(async () => {
  location.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'publication-date-'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(location.directory, { recursive: true, force: true });
});

it('公開日のみを採用し、不正日付・更新日・複数の異なる候補を採用しない', () => {
  expect(
    publicationDateFromHtml(
      '<script type="application/ld+json">{"@type":"Article","datePublished":"2026-09-24","dateModified":"2026-09-30"}</script>',
    ),
  ).toBe('2026-09-24T00:00:00.000Z');
  expect(
    publicationDateFromHtml(
      '<script type="application/ld+json">{"@graph":[{"@type":"BlogPosting","datePublished":"2026-09-24"}]}</script>',
    ),
  ).toBe('2026-09-24T00:00:00.000Z');
  for (const invalid of ['2026-02-30', '2026-09-24T10:00:00', 'yesterday', '', 42])
    expect(parsePublicationDate(invalid)).toBeUndefined();
  expect(publicationDateFromHtml('<meta property="article:modified_time" content="2026-09-24">')).toBeUndefined();
  expect(
    publicationDateFromHtml(
      '<meta property="article:published_time" content="2026-09-24"><meta property="article:published_time" content="2026-09-25">',
    ),
  ).toBeUndefined();
});

it('欠落項目だけを同一サイトから補い、公開日をキャッシュし元の日付を上書きしない', async () => {
  const original = makeSourceItem();
  const missing = { ...makeSourceItem({ link: 'https://example.com/missing' }), isoDate: '' };
  const external = { ...makeSourceItem({ link: 'https://other.example.com/article' }), isoDate: '' };
  const feed = { items: [original, missing, external] } as CustomRssParserFeed;
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(htmlResponse('2026-09-24'));
  await fillPublicationDates(feed, 'https://example.com/rss');
  expect(missing.isoDate).toBe('2026-09-24T00:00:00.000Z');
  expect(original.isoDate).toBe('2026-09-20T12:00:00.000Z');
  expect(external.isoDate).toBe('');
  missing.isoDate = '';
  await fillPublicationDates(feed, 'https://example.com/rss');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(missing.isoDate).toBe('2026-09-24T00:00:00.000Z');
});

it('記事取得が失敗しても後続記事を補い、取得時刻による日付を作らない', async () => {
  const feed = {
    items: ['bad', 'good'].map((id) => ({ ...makeSourceItem({ link: `https://example.com/${id}` }), isoDate: '' })),
  } as CustomRssParserFeed;
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(htmlResponse('2026-09-24'));
  await fillPublicationDates(feed, 'https://example.com/rss');
  expect(feed.items.map((item) => item.isoDate)).toEqual(['', '2026-09-24T00:00:00.000Z']);
});

it('Unicode URLの別記事をキャッシュで混同せず、再巡回では各公開日を再利用する', async () => {
  const feed = {
    items: ['é', 'ǩ'].map((id) => ({ ...makeSourceItem({ link: `https://example.com/${id}` }), isoDate: '' })),
  } as CustomRssParserFeed;
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(htmlResponse('2026-09-01'))
    .mockResolvedValueOnce(htmlResponse('2026-09-30'));
  await fillPublicationDates(feed, 'https://example.com/rss');
  expect(feed.items.map((item) => item.isoDate)).toEqual(['2026-09-01T00:00:00.000Z', '2026-09-30T00:00:00.000Z']);
  for (const item of feed.items) item.isoDate = '';
  await fillPublicationDates(feed, 'https://example.com/rss');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(feed.items.map((item) => item.isoDate)).toEqual(['2026-09-01T00:00:00.000Z', '2026-09-30T00:00:00.000Z']);
});

it('別サイトへのリダイレクトで得た日付を元記事に付けない', async () => {
  const feed = { items: [{ ...makeSourceItem(), isoDate: '' }] } as CustomRssParserFeed;
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(htmlResponse('2026-09-24', 'https://other.example.com/'));
  await fillPublicationDates(feed, 'https://example.com/rss');
  expect(feed.items[0].isoDate).toBe('');
});
