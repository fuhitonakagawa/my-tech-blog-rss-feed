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

const generate = async (items: CustomRssParserItem[], date = now) => {
  const result = await generateDeduplicatedFeeds(items, definitions, new Map(), new Map(), published, output, date);
  await new FeedStorer().storeSectionFeeds(result.feeds, path.join(output, 'deduplicated-feeds'));
  const sources: SlackSource[] = [...result.feeds].map(([id, feed]) => ({
    json: feed.json,
    rssUrl: sectionFeedUrls(id).rss,
    rssPath: `deduplicated-feeds/${id}/feeds/rss.xml`,
  }));
  const state = await generateSlackFeeds(sources, published, output, date);
  return { ...result, state, sources };
};

it('同時生成では企業を優先し、タグ・集約元間の重複を除いて元データを変更しない', async () => {
  const items = ['zenn', 'zenn-ai', 'qiita-ai', 'ai-news', 'company-tech-blog', 'jp-tech-blog'].map((id) =>
    article(id),
  );
  items.push(article('zenn-security', 'https://example.com/article?utm_source=tag#heading'));
  const before = structuredClone(items);
  const result = await generate(items);
  expect(result.state.feeds[historyKey('tech-blog-dedup')].items).toHaveLength(1);
  expect(result.state.feeds[historyKey('zenn-dedup')].items).toEqual([]);
  expect(result.state.feeds[historyKey('qiita-dedup')].items).toEqual([]);
  expect(result.statisticsItems[0].sectionId).toBe('tech-blog-dedup');
  expect(items).toEqual(before);
  expect(parseSlackState(JSON.stringify(result.state))).toEqual(result.state);
});

it('先にZennで公開した記事は、後から企業入力だけに現れても所属・通知日時・GUIDを維持する', async () => {
  const first = await generate([article('zenn-ai')]);
  await fs.cp(output, published, { recursive: true });
  const nextDate = new Date('2026-09-29T10:00:00.000Z');
  const later = await generate([{ ...article('jp-tech-blog'), guid: 'another-guid' }], nextDate);
  const previous = first.state.feeds[historyKey('zenn-dedup')].items[0];
  const current = later.state.feeds[historyKey('zenn-dedup')].items[0];
  expect(current.firstSeenAt).toBe(previous.firstSeenAt);
  expect(current.guid).toBe(previous.guid);
  expect(later.state.feeds[historyKey('tech-blog-dedup')].items).toEqual([]);
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

it('元記事日時が古くても最初に取得した生成回を優先し、対象外カテゴリには干渉しない', () => {
  const items = [
    article('zenn-ai'),
    { ...article('jp-tech-blog'), isoDate: '2026-09-20T00:00:00.000Z' },
    article('hatena', 'https://example.com/other'),
  ];
  const selected = selectDeduplicatedItems(items, definitions, null, now);
  expect(selected.get('tech-blog-dedup')).toHaveLength(1);
  expect([...selected.values()].flat()).toHaveLength(1);
});

it('ZennとQiitaは同順位で、取得順や定義順を変えても同じ配信先になる', () => {
  const items = Array.from({ length: 40 }, (_, i) =>
    ['zenn', 'qiita'].map((id) => article(id, `https://example.com/${i}`)),
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
  await generate([article('zenn')]);
  const result = await generate([article('zenn'), article('jp-tech-blog')], new Date('2026-09-28T11:00:00.000Z'));
  expect(result.state.feeds[historyKey('tech-blog-dedup')].items).toHaveLength(1);
  expect(result.state.feeds[historyKey('zenn-dedup')].items).toEqual([]);
});

it('入力から消えても90日以内の再登場は所属を維持し、90日を超えた履歴は再判定する', async () => {
  const first = await generate([article('zenn')]);
  const retained = selectDeduplicatedItems(
    [article('jp-tech-blog')],
    definitions,
    first.state,
    new Date('2026-12-01T00:00:00.000Z'),
  );
  expect(retained.get('zenn-dedup')).toHaveLength(1);
  const expired = selectDeduplicatedItems(
    [article('jp-tech-blog')],
    definitions,
    first.state,
    new Date('2027-01-01T00:00:00.000Z'),
  );
  expect(expired.get('tech-blog-dedup')).toHaveLength(1);
});

it('二重所属・壊れた公開履歴・不正記事で生成を停止する', async () => {
  const first = await generate([article('zenn')]);
  const corrupt: SlackFeedState = structuredClone(first.state);
  corrupt.feeds[historyKey('qiita-dedup')] = structuredClone(corrupt.feeds[historyKey('zenn-dedup')]);
  expect(() => selectDeduplicatedItems([], definitions, corrupt, now)).toThrow('二重所属');
  for (const item of [
    article('zenn', 'https://example.com/?access_token=private'),
    { ...article('zenn'), isoDate: 'invalid' },
  ])
    expect(() => selectDeduplicatedItems([item], definitions, null, now)).toThrow('不正');
  await fs.mkdir(path.join(published, 'feeds/delivery'), { recursive: true });
  await fs.writeFile(path.join(published, 'feeds/delivery/state.json'), '{}');
  await expect(generate([])).rejects.toThrow();
});

it('元RSSだけの掲載履歴を新しい3本の配信済み履歴と混同しない', async () => {
  const first = await generate([article('zenn')]);
  const state = { ...first.state, feeds: { [historyKey('zenn')]: first.state.feeds[historyKey('zenn-dedup')] } };
  expect(
    selectDeduplicatedItems([article('jp-tech-blog')], definitions, state, now).get('tech-blog-dedup'),
  ).toHaveLength(1);
  expect(Object.keys(first.state.feeds[historyKey('zenn-dedup')].seen)).toEqual([
    slackArticleKey(article('zenn').link),
  ]);
});

it('一部の配信履歴や公開RSSに対応する履歴が欠落していれば初期化しない', async () => {
  const first = await generate([article('zenn')]);
  const partial = structuredClone(first.state);
  delete partial.feeds[historyKey('qiita-dedup')];
  expect(() => selectDeduplicatedItems([], definitions, partial, now)).toThrow('欠落');
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
  const failed = await generate([article('zenn')], failedTime);
  expect(failed.usePublishedHistory).toBe(true);
  await generateStatistics(failed.statisticsItems, sections, publishedStats, outputStats, failedTime, [], [], ids);
  const nextTime = new Date('2026-09-28T15:00:00.000Z');
  const next = await generate([article('jp-tech-blog')], nextTime);
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
  expect(stats.reports[0].categories.find((category) => category.sectionId === 'tech-blog-dedup')?.count).toBe(1);
  expect(stats.reports[0].categories.find((category) => category.sectionId === 'zenn-dedup')?.count).toBe(0);
});

it('全3カテゴリの0件と重複除外後の統計を保存し、原文合計には加算しない', async () => {
  const result = await generate([article('jp-tech-blog'), article('zenn-ai')]);
  const sections = deduplicatedStatisticsSections(definitions);
  const first = updateStatistics(null, result.statisticsItems, sections, now);
  const state = updateStatistics(first, [], sections, new Date('2026-09-28T15:00:00.000Z'));
  const report = state.reports[0];
  expect(report.categories).toHaveLength(3);
  expect(report.categories.every((item) => item.kind === 'deduplicated')).toBe(true);
  expect(report.categories.map((item) => item.count)).toEqual([1, 0, 0]);
  expect(report.categories[0].feeds[0]).toMatchObject({
    kind: 'generated',
    count: 1,
    url: sectionFeedUrls('tech-blog-dedup').rss,
  });
  expect(parseStatisticsState(JSON.stringify(state))).toEqual(state);
  const html = load(renderStatisticsReport(report));
  expect(html('.ui-statistics-metrics dd').eq(0).text()).toBe('0件');
  expect(html.text()).toContain('重複除外版の掲載：1件');
});
