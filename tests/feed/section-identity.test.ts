import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import constants, { sectionFeedUrls, sectionPageUrl } from '../../src/common/constants';
import { selectDeduplicatedItems } from '../../src/feed/deduplication/selection';
import { FeedGenerator } from '../../src/feed/feed-generator';
import { FeedStorer } from '../../src/feed/feed-storer';
import { logger } from '../../src/feed/logger';
import { generateSlackFeeds } from '../../src/feed/slack/service';
import { loadSlackSources } from '../../src/feed/slack/sources';
import { updateStatistics } from '../../src/feed/statistics/aggregate';
import { statisticsConfig } from '../../src/feed/statistics/config';
import type { StatisticsSection } from '../../src/feed/statistics/observations';
import { generateStatistics } from '../../src/feed/statistics/service';
import { DISPLAY_SECTION_LIST } from '../../src/resources/display-section-list';
import { sectionPathId } from '../../src/resources/section-paths';
import { makeSourceItem } from '../helpers/translation-fixtures';

let directory: string;
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'section-identities-'));
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});

it('同順位の新着記事も管理用IDの表記で配信先を変えない', () => {
  const before = [
    { id: 'itmedia-dedup', title: 'Media', priority: 1, sourceSectionIds: ['one'] },
    { id: 'hatena-dedup', title: 'Bookmarks', priority: 1, sourceSectionIds: ['two'] },
  ];
  const after = before.map((definition, index) => ({
    ...definition,
    id: index === 0 ? 'it-media-dedup' : 'hatenab-dedup',
  }));
  const items = Array.from({ length: 40 }, (_, index) =>
    ['one', 'two'].map((sectionId) =>
      makeSourceItem({ sectionId, link: `https://example.com/${index}`, isoDate: '2026-09-28T00:00:00.000Z' }),
    ),
  ).flat();
  const now = new Date('2026-09-29T00:00:00.000Z');
  const original = selectDeduplicatedItems(items, before, null, now);
  const renamed = selectDeduplicatedItems(items, after, null, now);
  for (const [id, selected] of renamed) expect(selected).toEqual(original.get(sectionPathId(id)));
});

it('全セクションの保存・読み込み・通知が固定パスで一致し、公開履歴を引き継ぐ', async () => {
  const site = path.join(directory, 'site');
  const published = path.join(directory, 'published');
  const generator = new FeedGenerator();
  for (const group of ['section-feeds', 'translated-feeds', 'deduplicated-feeds']) {
    const feeds = new Map(
      DISPLAY_SECTION_LIST.filter((section) => section.feedDirectory === group).map((section) => [
        section.id,
        generator.generateFeeds(
          [makeSourceItem({ link: `https://example.com/${section.id}`, guid: `guid:${section.id}` })],
          new Map(),
          new Map(),
          200,
          500,
          {
            title: section.title,
            description: section.title,
            pageUrl: sectionPageUrl(section.id),
            feedUrls: sectionFeedUrls(section.id),
          },
        ).feedDistributionSet,
      ]),
    );
    await new FeedStorer().storeSectionFeeds(feeds, path.join(site, group));
  }
  const empty = JSON.stringify({ title: 'Feed', items: [] });
  for (const file of ['feeds/feed.json', `${statisticsConfig.feedPath}feed.json`]) {
    await fs.mkdir(path.dirname(path.join(site, file)), { recursive: true });
    await fs.writeFile(path.join(site, file), empty);
  }
  const sources = await loadSlackSources(site, []);
  expect(sources.some((source) => source.rssUrl === `${constants.siteUrl}rss/ai-jp/feeds/rss.xml`)).toBe(true);
  expect(sources.some((source) => source.rssPath === 'deduplicated-feeds/tech-blog-dedup/feeds/rss.xml')).toBe(true);
  const first = await generateSlackFeeds(sources, published, site, new Date('2026-09-29T00:00:00.000Z'));
  await fs.cp(site, published, { recursive: true });
  const next = await generateSlackFeeds(
    await loadSlackSources(site, []),
    published,
    site,
    new Date('2026-09-29T01:00:00.000Z'),
  );
  expect(Object.keys(next.feeds)).toEqual(Object.keys(first.feeds));
  for (const [url, history] of Object.entries(next.feeds)) {
    expect(history.lastIssuedAt).toBe(first.feeds[url].lastIssuedAt);
    expect(history.items.map((item) => [item.guid, item.firstSeenAt])).toEqual(
      first.feeds[url].items.map((item) => [item.guid, item.firstSeenAt]),
    );
  }
});

it('統計のIDを解決してから未公開dedupキャッシュを除外し、公開済み件数を保持する', async () => {
  const sourceUrl = 'https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/tech-blog-dedup/feeds/rss.xml';
  const oldSections: StatisticsSection[] = [
    { id: 'tech-blog-dedup', title: '企業', kind: 'deduplicated', feedInfoList: [{ url: sourceUrl }] },
  ];
  const newSections = [{ ...oldSections[0], id: 'my-tech-blog-jp-dedup' }];
  const firstItem = makeSourceItem({
    sectionId: 'tech-blog-dedup',
    sourceFeedUrl: sourceUrl,
    isoDate: '2026-09-28T01:00:00.000Z',
  });
  const initial = updateStatistics(null, [firstItem], oldSections, new Date('2026-09-28T10:00:00.000Z'));
  const publishedState = updateStatistics(initial, [], oldSections, new Date('2026-09-28T15:00:00.000Z'));
  const cachedState = updateStatistics(
    publishedState,
    [{ ...firstItem, link: 'https://example.com/unpublished' }],
    oldSections,
    new Date('2026-09-28T16:00:00.000Z'),
  );
  const published = path.join(directory, 'published');
  const output = path.join(directory, 'output');
  for (const [location, state] of [
    [published, publishedState],
    [output, cachedState],
  ] as const) {
    await fs.mkdir(location, { recursive: true });
    await fs.writeFile(path.join(location, 'state.json'), JSON.stringify(state));
  }
  const result = await generateStatistics(
    [],
    newSections,
    published,
    output,
    new Date('2026-09-28T17:00:00.000Z'),
    [],
    [],
    ['my-tech-blog-jp-dedup'],
  );
  expect(result.observations).toHaveLength(1);
  expect(result.observations[0].sectionId).toBe('my-tech-blog-jp-dedup');
  expect(result.reports[0].categories).toMatchObject([{ sectionId: 'my-tech-blog-jp-dedup', count: 1 }]);
  expect(result.reports[0].publishedAt).toBe(publishedState.reports[0].publishedAt);
});
