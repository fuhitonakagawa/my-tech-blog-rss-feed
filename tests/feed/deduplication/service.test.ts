import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { load } from 'cheerio';
import Parser from 'rss-parser';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { sectionFeedUrls } from '../../../src/common/constants';
import { selectDeduplicatedItems } from '../../../src/feed/deduplication/selection';
import { deduplicatedStatisticsSections, generateDeduplicatedFeeds } from '../../../src/feed/deduplication/service';
import type { CustomRssParserItem } from '../../../src/feed/feed-crawler';
import { FeedStorer } from '../../../src/feed/feed-storer';
import { logger } from '../../../src/feed/logger';
import { slackSourcePath } from '../../../src/feed/slack/config';
import { slackArticleKey } from '../../../src/feed/slack/model';
import { generateSlackFeeds } from '../../../src/feed/slack/service';
import { parseSlackState } from '../../../src/feed/slack/state-store';
import type { SlackFeedState, SlackSource } from '../../../src/feed/slack/types';
import { updateStatistics } from '../../../src/feed/statistics/aggregate';
import { generateStatistics } from '../../../src/feed/statistics/service';
import { parseStatisticsState } from '../../../src/feed/statistics/state-store';
import { DEDUPLICATED_FEED_DEFINITION_LIST as definitions } from '../../../src/resources/deduplicated-feed-list';
import { sectionPathId } from '../../../src/resources/section-paths';
import { renderStatisticsReport } from '../../../src/site/_includes/components/statistics-report';
import { makeSourceItem } from '../../helpers/translation-fixtures';

let directory: string;
let published: string;
let output: string;
const now = new Date('2026-09-28T10:00:00.000Z');
const article = (sectionId: string, link = 'https://example.com/article'): CustomRssParserItem =>
  makeSourceItem({
    sectionId,
    link,
    isoDate: '2026-09-28T01:00:00.000Z',
    sourceFeedUrl: `https://example.com/${sectionId}/rss`,
  });
const historyKey = (id: string): string => slackSourcePath(sectionFeedUrls(id).rss);

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deduplicated-feeds-'));
  published = path.join(directory, 'published');
  output = path.join(directory, 'output');
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});

const generate = async (items: CustomRssParserItem[], date = now, feedDefinitions = definitions) => {
  const result = await generateDeduplicatedFeeds(items, feedDefinitions, new Map(), new Map(), published, output, date);
  await new FeedStorer().storeSectionFeeds(result.feeds, path.join(output, 'deduplicated-feeds'));
  const sources: SlackSource[] = [...result.feeds].map(([id, feed]) => ({
    json: feed.json,
    rssUrl: sectionFeedUrls(id).rss,
    rssPath: `deduplicated-feeds/${sectionPathId(id)}/feeds/rss.xml`,
  }));
  const state = await generateSlackFeeds(sources, published, output, date);
  return { ...result, state, sources };
};

it('優先候補のGUIDが不正でも正常候補を配信し、公開済み所属を保持する', async () => {
  const company = article('my-tech-blog-jp');
  const qiita = { ...article('qiita-ai'), guid: 'valid-qiita' };
  const invalid = { ...company, guid: 'x'.repeat(8193) };
  const fresh = await generate([invalid, qiita]);
  expect(fresh.state.feeds[historyKey('qiita-dedup')].items).toHaveLength(1);
  expect(fresh.state.feeds[historyKey('my-tech-blog-jp-dedup')].items).toHaveLength(0);
  await fs.rm(output, { recursive: true });
  const first = await generate([company]);
  await fs.cp(output, published, { recursive: true });
  const later = await generate([invalid, qiita], new Date(now.getTime() + 3600_000));
  expect(later.state.feeds[historyKey('my-tech-blog-jp-dedup')].items[0]).toMatchObject({
    guid: first.state.feeds[historyKey('my-tech-blog-jp-dedup')].items[0].guid,
    firstSeenAt: first.state.feeds[historyKey('my-tech-blog-jp-dedup')].items[0].firstSeenAt,
  });
  expect(later.state.feeds[historyKey('qiita-dedup')].items).toHaveLength(0);
});

it('Physical AIの両タグを含め、企業・既存タグとの重複を除いて固有記事を配信する', async () => {
  const shared = 'https://example.com/company';
  const tagged = 'https://zenn.dev/example/articles/tagged';
  const items = [
    article('my-tech-blog-jp', shared),
    article('zenn-physical-ai', shared),
    article('qiita-physical-ai', shared),
    article('zenn-ai', tagged),
    article('zenn-physical-ai', tagged),
    article('zenn-physical-ai', 'https://zenn.dev/example/articles/unique'),
    article('qiita-physical-ai', 'https://qiita.com/example/items/unique'),
  ];
  items.push({ ...items[6], sourceFeedUrl: 'https://qiita.com/tags/robotics/feed', guid: 'other-tag' });
  const result = await generate(items);
  const urls = (id: string): string[] => result.state.feeds[historyKey(id)].items.map((item) => item.url).sort();
  expect(urls('my-tech-blog-jp-dedup')).toEqual([shared]);
  expect(urls('zenn-dedup')).toEqual([tagged, 'https://zenn.dev/example/articles/unique']);
  expect(urls('qiita-dedup')).toEqual(['https://qiita.com/example/items/unique']);
  await fs.cp(output, published, { recursive: true });
  const next = await generate([...items].reverse(), new Date(now.getTime() + 3600_000));
  for (const id of ['my-tech-blog-jp-dedup', 'zenn-dedup', 'qiita-dedup']) {
    expect(next.state.feeds[historyKey(id)].items).toEqual(result.state.feeds[historyKey(id)].items);
  }
});

it('同時生成では企業を優先し、タグ・集約元間の重複を除いて元データを変更しない', async () => {
  const items = [
    'zenn-trend',
    'zenn-ai',
    'qiita-ai',
    'karaage-ai-news',
    'company-tech-blog',
    'my-tech-blog-jp',
    'it-media',
    'menthas',
    'hatenab',
  ].map((id) => article(id));
  items.push(article('zenn-security', 'https://example.com/article?utm_source=tag#heading'));
  const before = structuredClone(items);
  const result = await generate(items);
  expect(result.state.feeds[historyKey('my-tech-blog-jp-dedup')].items).toHaveLength(1);
  expect(result.state.feeds[historyKey('zenn-dedup')].items).toEqual([]);
  expect(result.state.feeds[historyKey('qiita-dedup')].items).toEqual([]);
  expect(result.statisticsItems[0].sectionId).toBe('my-tech-blog-jp-dedup');
  expect(items).toEqual(before);
  expect(parseSlackState(JSON.stringify(result.state))).toEqual(result.state);
});

it('先にZennで公開した記事は、後から企業入力だけに現れても所属・通知日時・GUIDを維持する', async () => {
  const first = await generate([article('zenn-ai')]);
  await fs.cp(output, published, { recursive: true });
  const nextDate = new Date('2026-09-29T10:00:00.000Z');
  const later = await generate([{ ...article('my-tech-blog-jp'), guid: 'another-guid' }], nextDate);
  const previous = first.state.feeds[historyKey('zenn-dedup')].items[0];
  const current = later.state.feeds[historyKey('zenn-dedup')].items[0];
  expect(current.firstSeenAt).toBe(previous.firstSeenAt);
  expect(current.guid).toBe(previous.guid);
  expect(later.state.feeds[historyKey('my-tech-blog-jp-dedup')].items).toEqual([]);
  expect(later.statisticsItems[0].sectionId).toBe('zenn-dedup');
  const xml = await fs.readFile(path.join(output, 'deduplicated-feeds/zenn-dedup/feeds/rss.xml'), 'utf-8');
  const rss = await new Parser().parseString(xml);
  expect(rss.items[0].isoDate).toBe(now.toISOString());
  expect(rss.items[0].contentSnippet).toContain('元記事公開：2026/9/28 10:00:00');
  const json = JSON.parse(later.feeds.get('zenn-dedup')?.json ?? '');
  expect(json.items[0].date_published).toBe(article('zenn-ai').isoDate);
  const atom = await new Parser().parseString(later.feeds.get('zenn-dedup')?.atom ?? '');
  expect(atom.items[0].isoDate).toBe(article('zenn-ai').isoDate);
});

it('配信先を増やしても既存の所属・日時・GUIDを維持し、新しい入力だけの記事を配信する', async () => {
  const existingDefinitions = definitions.filter((definition) =>
    ['my-tech-blog-jp-dedup', 'zenn-dedup', 'qiita-dedup'].includes(definition.id),
  );
  const first = await generate([article('zenn-trend', 'https://example.com/existing')], now, existingDefinitions);
  await fs.cp(output, published, { recursive: true });
  const items = [
    article('it-media', 'https://example.com/existing'),
    article('it-media', 'https://example.com/itmedia'),
    {
      ...article('it-media', 'https://example.com/itmedia?utm_source=ai'),
      sourceFeedUrl: 'https://example.com/itmedia-ai/rss',
    },
    article('menthas', 'https://example.com/menthas'),
    article('hatenab', 'https://example.com/hatena'),
    ...['it-media', 'menthas', 'hatenab'].map((id) => article(id, 'https://example.com/shared')),
  ];
  const nextDate = new Date(now.getTime() + 3_600_000);
  const next = await generate(items, nextDate);
  expect(Object.keys(next.state.feeds)).toHaveLength(6);
  const saved = first.state.feeds[historyKey('zenn-dedup')].items[0];
  expect(next.state.feeds[historyKey('zenn-dedup')].items[0]).toMatchObject({
    key: saved.key,
    guid: saved.guid,
    firstSeenAt: saved.firstSeenAt,
  });
  const outputItems = Object.values(next.state.feeds).flatMap((feed) => feed.items);
  expect(outputItems).toHaveLength(5);
  expect(new Set(outputItems.map((item) => item.key)).size).toBe(5);
  for (const [id, url] of [
    ['it-media', 'https://example.com/itmedia'],
    ['menthas', 'https://example.com/menthas'],
    ['hatenab', 'https://example.com/hatena'],
  ]) {
    expect(next.state.feeds[historyKey(`${id}-dedup`)].items.some((item) => item.url === url)).toBe(true);
    expect(next.state.feeds[historyKey(`${id}-dedup`)].items.some((item) => item.url.endsWith('/existing'))).toBe(
      false,
    );
  }
  await fs.cp(output, published, { recursive: true });
  const later = await generate(
    [article('my-tech-blog-jp', 'https://example.com/hatena')],
    new Date(nextDate.getTime() + 3_600_000),
  );
  expect(later.state.feeds[historyKey('my-tech-blog-jp-dedup')].items).toEqual([]);
  expect(
    later.state.feeds[historyKey('hatenab-dedup')].items.find((item) => item.url.endsWith('/hatena'))?.firstSeenAt,
  ).toBe(nextDate.toISOString());
});

it('同順位の投稿サービス・ニュース間では入力順に依存せず1回だけ配信する', () => {
  const sections = ['zenn-trend', 'qiita-trend', 'it-media', 'menthas', 'hatenab'];
  const items = Array.from({ length: 100 }, (_, index) =>
    sections.map((id) => article(id, `https://example.com/shared-${index}`)),
  ).flat();
  const first = selectDeduplicatedItems(items, definitions, null, now);
  const reverse = selectDeduplicatedItems([...items].reverse(), [...definitions].reverse(), null, now);
  expect([...first.values()].flat()).toHaveLength(100);
  for (const id of ['zenn-dedup', 'qiita-dedup', 'it-media-dedup', 'menthas-dedup', 'hatenab-dedup']) {
    expect(first.get(id)).toEqual(reverse.get(id));
    expect(first.get(id)?.length).toBeGreaterThan(0);
  }
});

it('元記事日時が古くても最初に取得した生成回を優先し、対象外カテゴリには干渉しない', () => {
  const items = [
    article('zenn-ai'),
    { ...article('my-tech-blog-jp'), isoDate: '2026-09-20T00:00:00.000Z' },
    article('gigazine', 'https://example.com/other'),
  ];
  const selected = selectDeduplicatedItems(items, definitions, null, now);
  expect(selected.get('my-tech-blog-jp-dedup')).toHaveLength(1);
  expect([...selected.values()].flat()).toHaveLength(1);
});

it('ZennとQiitaは同順位で、取得順や定義順を変えても同じ配信先になる', () => {
  const items = Array.from({ length: 40 }, (_, i) =>
    ['zenn-trend', 'qiita-trend'].map((id) => article(id, `https://example.com/${i}`)),
  ).flat();
  const first = selectDeduplicatedItems(items, definitions, null, now);
  const reversed = selectDeduplicatedItems([...items].reverse(), [...definitions].reverse(), null, now);
  for (const id of ['zenn-dedup', 'qiita-dedup']) {
    expect(first.get(id)).toEqual(reversed.get(id));
    expect(first.get(id)?.length).toBeGreaterThan(0);
  }
  expect([...first.values()].flat()).toHaveLength(40);
});

it('公開失敗した生成の所属を引き継がず、公開済み履歴から再判定する', async () => {
  await fs.mkdir(published);
  await generate([article('zenn-trend')]);
  const result = await generate(
    [article('zenn-trend'), article('my-tech-blog-jp')],
    new Date('2026-09-28T11:00:00.000Z'),
  );
  expect(result.state.feeds[historyKey('my-tech-blog-jp-dedup')].items).toHaveLength(1);
  expect(result.state.feeds[historyKey('zenn-dedup')].items).toEqual([]);
});

it('入力から消えても90日以内の再登場は所属を維持し、90日を超えた履歴は再判定する', async () => {
  const first = await generate([article('zenn-trend')]);
  const retained = selectDeduplicatedItems(
    [article('my-tech-blog-jp')],
    definitions,
    first.state,
    new Date('2026-12-01T00:00:00.000Z'),
  );
  expect(retained.get('zenn-dedup')).toHaveLength(1);
  const expired = selectDeduplicatedItems(
    [article('my-tech-blog-jp')],
    definitions,
    first.state,
    new Date('2027-01-01T00:00:00.000Z'),
  );
  expect(expired.get('my-tech-blog-jp-dedup')).toHaveLength(1);
});

it('二重所属・壊れた公開履歴・不正記事で生成を停止する', async () => {
  const first = await generate([article('zenn-trend')]);
  const corrupt: SlackFeedState = structuredClone(first.state);
  corrupt.feeds[historyKey('qiita-dedup')] = structuredClone(corrupt.feeds[historyKey('zenn-dedup')]);
  expect(() => selectDeduplicatedItems([], definitions, corrupt, now)).toThrow('二重所属');
  for (const item of [
    article('zenn-trend', 'https://example.com/?access_token=private'),
    { ...article('zenn-trend'), isoDate: 'invalid' },
  ])
    expect(() => selectDeduplicatedItems([item], definitions, null, now)).toThrow('不正');
  await fs.mkdir(path.join(published, 'feeds/delivery'), { recursive: true });
  await fs.writeFile(path.join(published, 'feeds/delivery/state.json'), '{}');
  await expect(generate([])).rejects.toThrow();
});

it('元RSSだけの掲載履歴を重複除外RSSの配信済み履歴と混同しない', async () => {
  const first = await generate([article('zenn-trend')]);
  const state = { ...first.state, feeds: { [historyKey('zenn-trend')]: first.state.feeds[historyKey('zenn-dedup')] } };
  expect(
    selectDeduplicatedItems([article('my-tech-blog-jp')], definitions, state, now).get('my-tech-blog-jp-dedup'),
  ).toHaveLength(1);
  expect(Object.keys(first.state.feeds[historyKey('zenn-dedup')].seen)).toEqual([
    slackArticleKey(article('zenn-trend').link),
  ]);
});

it.each(['whole', 'partial'])('公開RSSに対応する履歴の欠落を初期化で隠さない: %s', async (missing) => {
  const first = await generate([article('zenn-trend')]);
  if (missing === 'partial') {
    const partial = structuredClone(first.state);
    delete partial.feeds[historyKey('zenn-dedup')];
    await fs.mkdir(path.join(published, 'feeds/delivery'), { recursive: true });
    await fs.writeFile(path.join(published, 'feeds/delivery/state.json'), JSON.stringify(partial));
  }
  const rssPath = path.join(published, historyKey('zenn-dedup'));
  await fs.mkdir(path.dirname(rssPath), { recursive: true });
  await fs.writeFile(rssPath, '<rss/>');
  await expect(generate([])).rejects.toThrow('配信履歴がありません');
});

it('公開失敗時の統計キャッシュから別の配信先の掲載件数を復活させない', async () => {
  const sections = deduplicatedStatisticsSections(definitions);
  const ids = definitions.map((definition) => definition.id);
  const publishedStats = path.join(published, 'feeds/statistics/daily');
  const outputStats = path.join(output, 'feeds/statistics/daily');
  await generateStatistics([], sections, publishedStats, outputStats, now);
  await fs.cp(output, published, { recursive: true });
  const failedTime = new Date('2026-09-28T11:00:00.000Z');
  const failed = await generate([article('zenn-trend')], failedTime);
  expect(failed.usePublishedHistory).toBe(true);
  await generateStatistics(failed.statisticsItems, sections, publishedStats, outputStats, failedTime, [], [], ids);
  const nextTime = new Date('2026-09-28T15:00:00.000Z');
  const next = await generate([article('my-tech-blog-jp')], nextTime);
  const stats = await generateStatistics(
    next.statisticsItems,
    sections,
    publishedStats,
    outputStats,
    nextTime,
    [],
    [],
    ids,
  );
  expect(stats.reports[0].categories.find((category) => category.sectionId === 'my-tech-blog-jp-dedup')?.count).toBe(1);
  expect(stats.reports[0].categories.find((category) => category.sectionId === 'zenn-dedup')?.count).toBe(0);
});

it('全カテゴリの0件と重複除外後の統計を保存し、原文合計には加算しない', async () => {
  const result = await generate([article('my-tech-blog-jp'), article('zenn-ai')]);
  const sections = deduplicatedStatisticsSections(definitions);
  const first = updateStatistics(null, result.statisticsItems, sections, now);
  const state = updateStatistics(first, [], sections, new Date('2026-09-28T15:00:00.000Z'));
  const report = state.reports[0];
  expect(report.categories).toHaveLength(definitions.length);
  expect(report.categories.every((item) => item.kind === 'deduplicated')).toBe(true);
  expect(report.categories.map((item) => item.count)).toEqual([1, 0, 0, 0, 0, 0]);
  expect(report.categories[0].feeds[0]).toMatchObject({
    kind: 'generated',
    count: 1,
    url: sectionFeedUrls('my-tech-blog-jp-dedup').rss,
  });
  expect(parseStatisticsState(JSON.stringify(state))).toEqual(state);
  const html = load(renderStatisticsReport(report));
  expect(html('.ui-statistics-metrics dd').eq(0).text()).toBe('0件');
  expect(html.text()).toContain('重複除外版の掲載：1件');
});
