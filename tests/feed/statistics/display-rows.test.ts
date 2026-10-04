import { load } from 'cheerio';
import Parser from 'rss-parser';
import { expect, it } from 'vitest';
import { sectionFeedUrls } from '../../../src/common/constants';
import { deduplicatedStatisticsSections } from '../../../src/feed/deduplication/service';
import { buildSlackRss, updateSlackFeed } from '../../../src/feed/slack/model';
import { updateStatistics } from '../../../src/feed/statistics/aggregate';
import { statisticsFeedUrls, statisticsPageUrl } from '../../../src/feed/statistics/config';
import { statisticsDisplayRows } from '../../../src/feed/statistics/display-rows';
import { buildStatisticsFeed } from '../../../src/feed/statistics/feed-builder';
import type { StatisticsSection } from '../../../src/feed/statistics/observations';
import { renderDailyReport } from '../../../src/feed/statistics/presentation';
import { parseStatisticsState } from '../../../src/feed/statistics/state-store';
import { DEDUPLICATED_FEED_DEFINITION_LIST } from '../../../src/resources/deduplicated-feed-list';
import { FEED_SECTION_LIST } from '../../../src/resources/feed-info-list';
import { renderStatisticsReport } from '../../../src/site/_includes/components/statistics-report';
import { makeSourceItem } from '../../helpers/translation-fixtures';

const definition = {
  id: 'zenn-dedup',
  title: 'Zenn dedup',
  sourceSectionIds: ['zenn-ai', 'zenn-cloud', 'zenn-security'],
  priority: 1,
};
const sections: StatisticsSection[] = [
  ...['AI', 'Cloud', 'Security'].map(
    (title): StatisticsSection => ({
      id: `zenn-${title.toLowerCase()}`,
      title: `Zenn ${title}${title === 'Security' ? 'タグ' : '関連タグ'}`,
      feedInfoList: [{ url: `https://example.com/${title.toLowerCase()}/rss`, label: title }],
    }),
  ),
  ...deduplicatedStatisticsSections([definition]),
];
const item = (id: string, sectionId: string, isoDate = '2026-09-30T00:00:00.000Z') =>
  makeSourceItem({
    link: `https://example.com/${id}`,
    sectionId,
    isoDate,
    sourceFeedUrl:
      sectionId === 'zenn-dedup'
        ? sectionFeedUrls(sectionId).rss
        : `https://example.com/${sectionId.replace('zenn-', '')}/rss`,
  });
const items = [
  item('shared', 'zenn-ai'),
  item('shared', 'zenn-cloud'),
  item('ai-only', 'zenn-ai'),
  item('other-owner', 'zenn-ai'),
  item('shared', 'zenn-dedup'),
  item('ai-only', 'zenn-dedup'),
];
const reportState = (input = items) => {
  const start = updateStatistics(null, input, sections, new Date('2026-09-30T12:00:00.000Z'));
  return updateStatistics(start, [], sections, new Date('2026-09-30T15:00:00.000Z'));
};

it('通知RSSは合計と全カテゴリを件数順で表示し、取得元の詳細をWebへまとめる', async () => {
  const speakerFeeds = [
    { url: 'https://speakerdeck.com/c/technology.atom', label: 'Technology - Speaker Deck' },
    { url: 'https://speakerdeck.com/c/programming.atom', label: 'Programming - Speaker Deck' },
    { url: 'https://speakerdeck.com/c/design.atom', label: 'Design - Speaker Deck' },
  ] as const;
  const sources: StatisticsSection[] = [
    {
      id: 'speakerdeck',
      title: 'Speaker Deck',
      feedInfoList: speakerFeeds,
    },
    { id: 'aws', title: 'AWS', feedInfoList: [{ url: 'https://example.com/aws/rss', language: 'en' }] },
    { id: 'autonomous-driving', title: '自動運転' },
    { id: 'empty', title: '0件カテゴリ' },
  ];
  const translations = [
    {
      id: 'aws-translated-jp',
      title: 'AWS 翻訳',
      sourceSectionId: 'aws',
      sourceLanguage: 'en' as const,
      targetLanguage: 'ja' as const,
    },
  ];
  const input = [
    ...speakerFeeds.slice(0, 2).map((feed) =>
      makeSourceItem({
        link: 'https://speakerdeck.com/example/shared',
        sectionId: 'speakerdeck',
        sourceFeedUrl: feed.url,
        isoDate: '2026-09-30T00:00:00.000Z',
      }),
    ),
    item('aws-one', 'aws'),
    item('aws-two', 'aws'),
    item('driving', 'autonomous-driving'),
  ];
  const initial = updateStatistics(null, input, sources, new Date('2026-09-30T12:00:00.000Z'), translations, [
    input[2],
  ]);
  const state = updateStatistics(initial, [], sources, new Date('2026-09-30T15:00:00.000Z'), translations);
  const report = state.reports[0];
  const source = {
    rssUrl: statisticsFeedUrls.rss,
    rssPath: 'feeds/statistics/daily/rss.xml',
    json: buildStatisticsFeed(state).json,
  };
  const first = updateSlackFeed(source, undefined, new Date('2026-09-30T16:00:00.000Z'));
  const history = updateSlackFeed(source, first, new Date('2026-09-30T17:00:00.000Z'));
  const rss = await new Parser().parseString(buildSlackRss(source.rssUrl, history));
  const text = rss.items[0].contentSnippet ?? '';
  expect(text).toMatch(/^合計投稿数：4件（原文カテゴリ合計・延べ）/);
  expect(text).not.toContain('元記事公開：');
  expect(text).not.toContain('新着記事をまとめました');
  expect(text).not.toContain('Design - Speaker Deck');
  expect(text).not.toContain('Technology - Speaker Deck');
  expect(text).toContain('Speaker Deck：1件');
  expect(text).toContain('自動運転：1件');
  expect(text).toContain('0件カテゴリ：0件');
  expect(text).toContain(`${statisticsPageUrl}#${report.date}`);
  const body = load(renderDailyReport(report));
  expect(
    body('li')
      .map((_, element) => body(element).text())
      .get(),
  ).toEqual(['AWS：2件（en 2件 / translated-jp 1件）', '自動運転：1件', 'Speaker Deck：1件', '0件カテゴリ：0件']);
  const web = load(renderStatisticsReport(report));
  expect(web('.ui-statistics-metrics dd').first().text()).toBe('4件');
  expect(web('a[href="https://speakerdeck.com/c/design.atom"]').text()).toBe('Design - Speaker Deck');
  expect(web('a[href="https://speakerdeck.com/c/design.atom"]').closest('li').text()).toContain('0件');
  expect(history.items[0].guid).toBe(first.items[0].guid);
  expect(rss.items[0].isoDate).toBe(first.items[0].firstSeenAt);
  expect(history.items[0].originalPublishedAt).toBe(report.publishedAt);
});

it('dedup掲載記事だけの所属を数え、複数カテゴリ所属と0件を保持する', () => {
  const state = reportState();
  const report = state.reports[0];
  const rows = statisticsDisplayRows(report.categories);
  expect(rows).toHaveLength(1);
  expect(rows[0].category.count).toBe(2);
  expect(rows[0].parts).toEqual([
    { title: 'AI', count: 2 },
    { title: 'Cloud', count: 1 },
    { title: 'Security', count: 0 },
  ]);
  expect(rows[0].children.find((category) => category.sectionId === 'zenn-ai')?.count).toBe(3);
  const rss = load(renderDailyReport(report));
  expect(rss.text()).toContain('Zenn dedup：2件（AI 2件 / Cloud 1件 / Security 0件）');
  expect(rss.text()).not.toContain('Zenn dedup（生成RSS）');
  expect(rss('p').first().text()).toBe('合計投稿数：4件（原文カテゴリ合計・延べ）');
  expect(rss('ul > li')).toHaveLength(1);
  const web = load(renderStatisticsReport(report));
  expect(web('.ui-statistics-category')).toHaveLength(1);
  expect(web('.ui-statistics-child-category')).toHaveLength(3);
  expect(web('a[href="https://example.com/ai/rss"]')).toHaveLength(1);
  expect(parseStatisticsState(JSON.stringify(state))).toEqual(state);
});

it('所属を確認できない記事を推測せず、所属不明として表示する', () => {
  const report = reportState([...items, item('unknown', 'zenn-dedup')]).reports[0];
  const row = statisticsDisplayRows(report.categories)[0];
  expect(row.category.count).toBe(3);
  expect(row.parts).toContainEqual({ title: '所属不明', count: 1 });
});

it.each(DEDUPLICATED_FEED_DEFINITION_LIST)(
  '$titleと元カテゴリを1行にまとめ、取得件数とWebの詳細を保持する',
  (definition) => {
    const sources: StatisticsSection[] = definition.sourceSectionIds.map((id) => ({
      id,
      title: FEED_SECTION_LIST.find((section) => section.id === id)?.title ?? id,
      feedInfoList: [{ url: `https://example.com/${id}/rss`, label: `${id} RSS` }],
    }));
    const allSections = [...sources, ...deduplicatedStatisticsSections([definition])];
    const input = allSections.flatMap((section) =>
      (section.kind === 'deduplicated' ? ['shared'] : ['shared', 'other-owner']).map((id) =>
        makeSourceItem({
          link: `https://example.com/${id}`,
          sectionId: section.id,
          isoDate: '2026-09-30T00:00:00.000Z',
          sourceFeedUrl: section.feedInfoList?.[0].url,
        }),
      ),
    );
    const initial = updateStatistics(null, input, allSections, new Date('2026-09-30T12:00:00.000Z'));
    const report = updateStatistics(initial, [], allSections, new Date('2026-09-30T15:00:00.000Z')).reports[0];
    const saved = structuredClone(report);
    const rows = statisticsDisplayRows(report.categories);
    expect(rows).toHaveLength(1);
    expect(rows[0].category.count).toBe(1);
    expect(rows[0].parts.map((part) => part.count)).toEqual(sources.map(() => 1));
    expect(rows[0].children.map((child) => child.count)).toEqual(sources.map(() => 2));
    const rss = load(renderDailyReport(report));
    expect(rss('ul > li')).toHaveLength(1);
    expect(rss('li').text()).toContain(`${definition.title}：1件（`);
    expect(rss.text()).not.toContain('（生成RSS）');
    const web = load(renderStatisticsReport(report));
    expect(web('.ui-statistics-category')).toHaveLength(1);
    expect(web('.ui-statistics-child-category')).toHaveLength(sources.length);
    expect(web('.ui-statistics-metrics dd').first().text()).toBe(`${sources.length * 2}件`);
    for (const source of sources) {
      expect(web(`a[href="https://example.com/${source.id}/rss"]`)).toHaveLength(1);
      expect(rows[0].children.some((child) => child.sectionId === source.id)).toBe(true);
    }
    expect(report).toEqual(saved);
    const originalOnly = statisticsDisplayRows(report.categories.filter((category) => category.kind === 'source'));
    expect(originalOnly).toHaveLength(sources.length);
    expect(originalOnly.every((row) => !row.grouped && row.category.count === 2)).toBe(true);
  },
);

it('元カテゴリとdedupの計上日に差があっても、記事の所属を保持する', () => {
  const initial = updateStatistics(null, [], sections, new Date('2026-09-28T15:00:00.000Z'));
  const state = updateStatistics(
    initial,
    [item('shared', 'zenn-ai', '2026-09-29T00:00:00.000Z'), item('shared', 'zenn-dedup')],
    sections,
    new Date('2026-09-30T15:00:00.000Z'),
  );
  expect(
    state.reports[0].categories.find((category) => category.sectionId === 'zenn-dedup')?.sourceCategories,
  ).toContainEqual({ sectionId: 'zenn-ai', title: 'Zenn AI関連タグ', count: 1 });
});

it('保存された内訳の負数・重複・総数を超える単一内訳を拒否する', () => {
  for (const count of [-1, 3]) {
    const state = reportState();
    const parts = state.reports[0].categories.find((category) => category.sectionId === 'zenn-dedup')?.sourceCategories;
    if (!parts) throw new Error('内訳がありません');
    parts[0].count = count;
    expect(() => parseStatisticsState(JSON.stringify(state))).toThrow();
  }
  const state = reportState();
  const parts = state.reports[0].categories.find((category) => category.sectionId === 'zenn-dedup')?.sourceCategories;
  if (!parts) throw new Error('内訳がありません');
  parts.push(parts[0]);
  expect(() => parseStatisticsState(JSON.stringify(state))).toThrow();
});
