import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { create as createCache } from 'flat-cache';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import constants from '../../src/common/constants';
import { AcquisitionHistory } from '../../src/feed/acquisition-history';
import { type CustomRssParserFeed, type CustomRssParserItem, FeedCrawler } from '../../src/feed/feed-crawler';
import { logger } from '../../src/feed/logger';
import { RECOVERY_ARTICLES, recoveryArticles } from '../../src/feed/recovery-articles';
import { slackArticleKey } from '../../src/feed/slack/model';
import { generateSlackFeeds } from '../../src/feed/slack/service';
import { FeedHttpError } from '../../src/feed/source-request';
import { FEED_INFO_LIST, type FeedInfo } from '../../src/resources/feed-info-list';

const location = vi.hoisted(() => ({ directory: '' }));
vi.mock('flat-cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('flat-cache')>();
  return {
    ...actual,
    create: (options: Parameters<typeof actual.create>[0]) =>
      actual.create({ ...options, cacheDir: location.directory }),
  };
});

const now = new Date('2026-10-08T13:00:00.000Z');
const sourceUrl = 'https://example.com/rss';
const article = (link = 'https://example.com/article', isoDate = '2026-10-08T01:00:00.000Z'): CustomRssParserItem => ({
  link,
  guid: link,
  title: '記事',
  isoDate,
  summary: '概要',
  creator: 'Author',
  categories: ['Tech'],
  blogTitle: 'Source',
  blogLink: 'https://example.com/',
  sectionId: 'hacker-news',
  sourceLanguage: 'en',
  sourceFeedUrl: sourceUrl,
});
const feed = (items: CustomRssParserItem[] = []): CustomRssParserFeed => ({
  title: 'Source',
  link: 'https://example.com/',
  sectionId: 'hacker-news',
  items,
});

beforeEach(async () => {
  location.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'feed-acquisition-'));
  vi.stubEnv('FEED_ACQUISITION_DIR', path.join(location.directory, 'journal'));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await fs.rm(location.directory, { recursive: true, force: true });
});

it('元RSSから消えた取得済み記事を次のプロセスへ引き継ぎ、公開日時とGUIDを保持する', () => {
  new AcquisitionHistory().enrich(feed([article()]), sourceUrl);
  vi.setSystemTime(new Date(now.getTime() + 3600_000));
  const next = feed([article('https://example.com/new')]);
  expect(new AcquisitionHistory().enrich(next, sourceUrl)).toBe(1);
  expect(next.items.find((x) => x.link === article().link)).toMatchObject(article());
  const updated = { ...article(), title: '更新された記事' };
  new AcquisitionHistory().enrich(feed([updated]), sourceUrl);
  const restored = feed();
  new AcquisitionHistory().enrich(restored, sourceUrl, [], 'en');
  expect(restored.items.find((x) => x.link === updated.link)?.title).toBe(updated.title);
});

it('専用保存先への更新に失敗した実行のバックアップから未公開記事を回収する', async () => {
  const backup = path.join(location.directory, 'backup');
  new AcquisitionHistory(backup).enrich(feed([article()]), sourceUrl);
  vi.stubEnv('FEED_ACQUISITION_RECOVERY_DIR', backup);
  const restored = feed();
  expect(new AcquisitionHistory().enrich(restored, sourceUrl)).toBe(1);
  expect(restored.items[0]).toMatchObject({
    guid: article().guid,
    isoDate: article().isoDate,
    recoveredUnpublished: true,
  });
  expect(new AcquisitionHistory(undefined, new Set([slackArticleKey(article().link)])).enrich(feed(), sourceUrl)).toBe(
    0,
  );
});

it('取得元を分離し、復元時のカテゴリ・言語は現在の登録情報を使う', () => {
  new AcquisitionHistory().enrich(feed([article()]), sourceUrl);
  const another = feed();
  expect(new AcquisitionHistory().enrich(another, 'https://example.com/another-rss')).toBe(0);
  const moved = { ...feed(), sectionId: 'my-tech-blog-jp' };
  new AcquisitionHistory().enrich(moved, sourceUrl, [], 'ja');
  expect(moved.items[0]).toMatchObject({
    sectionId: 'my-tech-blog-jp',
    sourceLanguage: 'ja',
    sourceFeedUrl: sourceUrl,
  });
});

it('古い共有キャッシュの復元で専用記録を巻き戻さず、移行後はキャッシュから復活させない', async () => {
  new AcquisitionHistory().enrich(feed([article()]), sourceUrl);
  const files = await fs.readdir(path.join(location.directory, 'journal'));
  const id = files[0].replace(/\.json$/, '');
  const stale = createCache({ cacheId: id });
  stale.set('snapshot', { sourceUrl, items: [] });
  stale.save();
  expect(new AcquisitionHistory().enrich(feed(), sourceUrl)).toBe(1);
  await fs.writeFile(path.join(location.directory, 'journal/index.json'), '{}');
  new AcquisitionHistory(undefined, new Set([slackArticleKey(article().link)])).enrich(feed(), sourceUrl);
  stale.set('snapshot', { sourceUrl, items: [article()] });
  stale.save();
  expect(new AcquisitionHistory().enrich(feed(), sourceUrl)).toBe(0);
});

it('取得記録の保存失敗をフィード取得成功として握りつぶさない', async () => {
  const journal = path.join(location.directory, 'journal');
  await fs.writeFile(journal, 'directory is unavailable');
  const info: FeedInfo = {
    label: 'Source',
    url: sourceUrl,
    language: 'en',
    sectionId: 'hacker-news',
    input: { kind: 'remote', url: sourceUrl },
  };
  const crawler = new FeedCrawler() as unknown as {
    fetchSourceFeed(info: FeedInfo): Promise<CustomRssParserFeed>;
    fetchFeedsAsync(info: FeedInfo[], concurrency: number): Promise<CustomRssParserFeed[]>;
  };
  vi.spyOn(crawler, 'fetchSourceFeed').mockResolvedValue(feed([article()]));
  await expect(crawler.fetchFeedsAsync([info], 1)).rejects.toThrow('取得記録の保存');
});

it('補完処理が失敗しても先頭ページの取得記録を残し、生成フィードが利用不能でも回収する', async () => {
  const info: FeedInfo = {
    label: 'Source',
    url: sourceUrl,
    language: 'en',
    sectionId: 'hacker-news',
    input: { kind: 'remote', url: sourceUrl },
  };
  const crawler = new FeedCrawler() as unknown as {
    fetchSourceFeed(info: FeedInfo): Promise<CustomRssParserFeed>;
    fetchFeedsAsync(info: FeedInfo[], concurrency: number): Promise<CustomRssParserFeed[]>;
    qiitaOrganization: { enrich(feed: CustomRssParserFeed, url: string): Promise<boolean> };
  };
  vi.spyOn(crawler, 'fetchSourceFeed').mockResolvedValue(feed([article()]));
  vi.spyOn(crawler.qiitaOrganization, 'enrich').mockRejectedValue(new Error('supplement failed'));
  await expect(crawler.fetchFeedsAsync([info], 1)).rejects.toThrow('取得後処理');
  const retry = new FeedCrawler() as unknown as typeof crawler;
  const result = await retry.fetchFeedsAsync([{ ...info, input: { kind: 'generated', id: 'unavailable' } }], 1);
  expect(result[0].items[0]).toMatchObject({ link: article().link, guid: article().guid, isoDate: article().isoDate });
});

it('日付なし・未来・期間外・不正識別子を新規保存せず、未公開記事は期間を過ぎても補完する', () => {
  new AcquisitionHistory().enrich(
    feed([
      article(),
      article('https://example.com/old', '2026-09-01T00:00:00.000Z'),
      article('https://example.com/future', '2027-01-01T00:00:00.000Z'),
      article('https://example.com/no-date', ''),
      { ...article('https://example.com/bad'), guid: 'bad\uFFFE' },
    ]),
    sourceUrl,
  );
  const next = feed();
  expect(new AcquisitionHistory().enrich(next, sourceUrl)).toBe(1);
  expect(next.items.map((x) => x.link)).toEqual([article().link]);
  vi.setSystemTime(new Date(now.getTime() + 9 * 86400_000));
  expect(new AcquisitionHistory().enrich(feed(), sourceUrl)).toBe(1);
  expect(new AcquisitionHistory(undefined, new Set([slackArticleKey(article().link)])).enrich(feed(), sourceUrl)).toBe(
    0,
  );
});

it('日別アンカーを区別し、追跡パラメーターだけの違いでは重複させない', () => {
  const base = 'https://cloud.google.com/vertex-ai/docs/release-notes';
  new AcquisitionHistory().enrich(
    feed([
      article(`${base}#October_7_2026`),
      article(`${base}#October_8_2026`),
      article('https://example.com/a?utm_source=rss'),
    ]),
    sourceUrl,
  );
  const next = feed([article('https://example.com/a')]);
  expect(new AcquisitionHistory().enrich(next, sourceUrl)).toBe(2);
  expect(next.items).toHaveLength(3);
});

it('破損した永続記録を初期化で消さずに失敗させる', () => {
  new AcquisitionHistory().enrich(feed([article()]), sourceUrl);
  const directory = path.join(location.directory, 'journal');
  const files = fs.readdir(directory);
  return files.then(async ([id]) => {
    await fs.writeFile(
      path.join(directory, id),
      JSON.stringify({ sourceUrl, items: [{ ...article(), isoDate: 'not-a-date' }] }),
    );
    const current = feed([article('https://example.com/current')]);
    expect(() => new AcquisitionHistory().enrich(current, sourceUrl)).toThrow('取得記録の内容');
  });
});

it('取得元が403でも履歴の期間内記事を保持し、取得状態をfallbackとして報告する', async () => {
  const info: FeedInfo = {
    label: 'Source',
    url: sourceUrl,
    language: 'en',
    sectionId: 'hacker-news',
    input: { kind: 'remote', url: sourceUrl },
  };
  const crawler = new FeedCrawler() as unknown as {
    fetchSourceFeed(info: FeedInfo): Promise<CustomRssParserFeed>;
    fetchFeedsAsync(info: FeedInfo[], concurrency: number): Promise<CustomRssParserFeed[]>;
    sourceObservations: Map<string, unknown>;
  };
  vi.spyOn(crawler, 'fetchSourceFeed')
    .mockResolvedValueOnce(feed([article()]))
    .mockRejectedValueOnce(new FeedHttpError(403));
  await crawler.fetchFeedsAsync([info], 1);
  const restored = await crawler.fetchFeedsAsync([info], 1);
  expect(restored[0].items[0]).toMatchObject({ link: article().link, sourceLanguage: 'en' });
  expect(crawler.sourceObservations.get(sourceUrl)).toMatchObject({ status: 'fallback', httpStatus: 403 });
});

it('生成失敗後の回収記事だけを新しい通知日時で配信し、既知記事と再実行の日時を維持する', async () => {
  const published = path.join(location.directory, 'published');
  const output = path.join(location.directory, 'output');
  const source = (items: CustomRssParserItem[]) => ({
    rssUrl: `${constants.siteUrl}rss/ai-jp/feeds/rss.xml`,
    rssPath: 'translated-feeds/ai-jp/feeds/rss.xml',
    json: JSON.stringify({
      title: 'AI',
      items: items.map((item) => ({ id: item.guid, url: item.link, title: item.title, date_published: item.isoDate })),
    }),
  });
  const known = article();
  const first = await generateSlackFeeds([source([known])], published, output, now);
  await fs.cp(output, published, { recursive: true });
  const missed = article('https://example.com/missed');
  new AcquisitionHistory().enrich(feed([known, missed]), sourceUrl);
  await expect(
    generateSlackFeeds([{ ...source([known, missed]), json: '{' }], published, output, now),
  ).rejects.toThrow();
  vi.setSystemTime(new Date(now.getTime() + 3600_000));
  const recovered = feed();
  new AcquisitionHistory().enrich(recovered, sourceUrl);
  const state = await generateSlackFeeds([source(recovered.items)], published, output, new Date());
  const key = 'rss/ai-jp/feeds/rss.xml';
  expect(state.feeds[key].items.find((x) => x.url === known.link)?.firstSeenAt).toBe(first.feeds[key].lastIssuedAt);
  expect(state.feeds[key].items.find((x) => x.url === missed.link)).toMatchObject({
    guid: missed.guid,
    firstSeenAt: new Date().toISOString(),
    originalPublishedAt: missed.isoDate,
  });
  await fs.cp(output, published, { recursive: true });
  vi.setSystemTime(new Date(now.getTime() + 7200_000));
  const rerun = await generateSlackFeeds([source(recovered.items)], published, output, new Date());
  expect(rerun.feeds[key].items.map((x) => [x.guid, x.firstSeenAt])).toEqual(
    state.feeds[key].items.map((x) => [x.guid, x.firstSeenAt]),
  );
});

it('確認済み補完記事を登録済みの取得元から回収し、期限が過ぎれば配信候補にしない', () => {
  const found = new Set<string>();
  for (const info of FEED_INFO_LIST) {
    const input = feed();
    new AcquisitionHistory().enrich(input, info.url, recoveryArticles(info.url));
    for (const item of input.items) found.add(item.link);
  }
  expect(found).toEqual(new Set(RECOVERY_ARTICLES.map((item) => item.link)));
  vi.setSystemTime(new Date('2026-11-08T00:00:00.000Z'));
  expect(new AcquisitionHistory().enrich(feed(), sourceUrl, RECOVERY_ARTICLES)).toBe(0);
});
