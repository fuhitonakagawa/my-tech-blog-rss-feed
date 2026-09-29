import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { load } from 'cheerio';
import RssParser from 'rss-parser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../../src/feed/logger';
import { statisticsFeedUrls, statisticsPageUrl } from '../../../src/feed/statistics/config';
import type { StatisticsSection } from '../../../src/feed/statistics/observations';
import { generateStatistics } from '../../../src/feed/statistics/service';
import { readStatisticsState } from '../../../src/feed/statistics/state-store';
import type { TranslatedFeedDefinition } from '../../../src/resources/translated-feed-list';
import { render as renderStatisticsPage } from '../../../src/site/statistics.11ty';
import { makeSourceItem } from '../../helpers/translation-fixtures';

let directory: string;
let published: string;
let output: string;
const sections = [{ id: 'ai', title: 'AI & <安全>' }];
const firstTime = new Date('2026-09-27T01:00:00.000Z');
const nextDay = new Date('2026-09-27T15:00:00.000Z');
const item = makeSourceItem({ link: 'https://example.com/article', isoDate: '2026-09-27T00:00:00.000Z' });

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-statistics-'));
  published = path.join(directory, 'published');
  output = path.join(directory, 'output');
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});

describe('日次統計の保存と配信', () => {
  it('公開履歴より新しいキャッシュの翻訳掲載記録を保持する', async () => {
    const source = { ...item, sourceFeedUrl: 'https://example.com/rss' };
    const currentSections: StatisticsSection[] = [
      {
        id: 'ai',
        title: 'AI',
        feedInfoList: [{ url: 'https://example.com/rss', label: 'Source', language: 'en' }],
      },
    ];
    const translations: TranslatedFeedDefinition[] = [
      {
        id: 'ai-jp',
        title: 'AI 翻訳',
        sourceSectionId: 'ai',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
      },
    ];
    await generateStatistics([source], currentSections, published, output, firstTime, translations);
    await fs.cp(output, published, { recursive: true });
    const cached = await generateStatistics([], currentSections, published, output, nextDay, translations, [source]);
    const restored = await generateStatistics(
      [],
      currentSections,
      published,
      output,
      new Date(nextDay.getTime() + 1000),
      translations,
    );
    expect(restored.observations[0].inTranslatedFeed).toBe(true);
    expect(restored.reports).toEqual(cached.reports);
    expect(restored.reports[0].categories.find((category) => category.kind === 'translated')?.count).toBe(1);
  });

  it('公開履歴とキャッシュを統合しても移動前のカテゴリへ重複計上しない', async () => {
    const sourceUrl = 'https://example.com/rss';
    const sourceItem = { ...item, sourceFeedUrl: sourceUrl };
    const firstSections: StatisticsSection[] = [{ id: 'ai', title: 'AI', feedInfoList: [{ url: sourceUrl }] }];
    const movedSections: StatisticsSection[] = [
      { id: 'ai', title: 'AI', feedInfoList: [] },
      { id: 'jvn', title: 'JVN', feedInfoList: [{ url: sourceUrl }] },
    ];
    await generateStatistics([sourceItem], firstSections, published, output, firstTime);
    await fs.cp(output, published, { recursive: true });
    const cached = await generateStatistics([], movedSections, published, output, nextDay);
    const merged = await generateStatistics([], movedSections, published, output, new Date('2026-09-27T16:00:00.000Z'));
    expect(merged.observations).toHaveLength(1);
    expect(merged.observations[0].sectionId).toBe('jvn');
    expect(merged.reports).toEqual(cached.reports);
  });

  it('0件のカテゴリもRSSとページへ表示し、投稿のあるカテゴリ数には含めない', async () => {
    const allSections = [...sections, { id: 'empty', title: '0件カテゴリ' }];
    await generateStatistics([item], allSections, published, output, firstTime);
    const state = await generateStatistics([], allSections, published, output, nextDay);
    const rss = await new RssParser().parseString(await fs.readFile(path.join(output, 'rss.xml'), 'utf-8'));
    expect(rss.items[0]['content:encoded']).toContain('0件カテゴリ</a>：0件');
    expect(rss.items[0].content).toContain('1カテゴリで記事を取得');
    const page = load(renderStatisticsPage({ page: { url: '/statistics/daily/' }, statistics: state }));
    expect(page('.ui-statistics-category').last().text()).toContain('0件カテゴリ');
    expect(page('.ui-statistics-category > details > summary .ui-statistics-count').last().text()).toBe('0件');
    expect(page('.ui-statistics-metrics dd').last().text()).toBe('1カテゴリ');
  });

  it('取得元不明の公開履歴を復元しても補正済みキャッシュから旧所属を復活させない', async () => {
    const first = await generateStatistics([item], sections, published, output, firstTime);
    await fs.mkdir(published);
    await fs.writeFile(path.join(published, 'state.json'), JSON.stringify({ ...first, schemaVersion: 1 }));
    const currentSections: StatisticsSection[] = [
      ...sections,
      { id: 'jvn', title: 'JVN', feedInfoList: [{ url: 'https://example.com/jvn.rss' }] },
    ];
    const moved = { ...item, sectionId: 'jvn', sourceFeedUrl: 'https://example.com/jvn.rss' };
    const corrected = await generateStatistics([moved], currentSections, published, output, nextDay);
    const repeated = await generateStatistics(
      [],
      currentSections,
      published,
      output,
      new Date('2026-09-27T16:00:00.000Z'),
    );
    expect(repeated.observations).toEqual(corrected.observations);
    expect(repeated.reports).toEqual(corrected.reports);
    expect(repeated.observations.map((observation) => observation.sectionId)).toEqual(['jvn']);
  });

  it('公開履歴を復元し、RSS・Atom・JSONと閲覧ページで同じ日付・カテゴリを配信する', async () => {
    const first = await generateStatistics([item], sections, published, output, firstTime);
    expect(first.reports).toEqual([]);
    expect(
      (await new RssParser().parseString(await fs.readFile(path.join(output, 'rss.xml'), 'utf-8'))).items,
    ).toHaveLength(0);
    await fs.cp(output, published, { recursive: true });
    await fs.rm(output, { recursive: true });
    const state = await generateStatistics([], sections, published, output, nextDay);
    expect(state.reports).toHaveLength(1);
    const rss = await new RssParser().parseString(await fs.readFile(path.join(output, 'rss.xml'), 'utf-8'));
    const atom = await new RssParser().parseString(await fs.readFile(path.join(output, 'atom.xml'), 'utf-8'));
    const json = JSON.parse(await fs.readFile(path.join(output, 'feed.json'), 'utf-8'));
    expect(rss.items).toHaveLength(1);
    expect(atom.items).toHaveLength(1);
    expect(json.feed_url).toBe(statisticsFeedUrls.json);
    expect(json.items[0].id).toBe(`${statisticsPageUrl}#2026-09-27`);
    expect(rss.items[0].guid).toBe(json.items[0].id);
    expect(json.items[0].content_html).toContain('AI &amp; &lt;安全&gt;');
    expect(json.items[0].content_html).toContain('1件');
    const html = renderStatisticsPage({ page: { url: '/statistics/daily/' }, statistics: state });
    expect(html).toContain('id="2026-09-27"');
    const page = load(html);
    const report = page('article[id="2026-09-27"]');
    expect(report.find('time').attr('datetime')).toBe('2026-09-27');
    expect(report.find('.ui-statistics-category-title').text()).toBe('AI & <安全>');
    expect(report.find('summary .ui-statistics-count').text()).toBe('1件');
    expect(report.find('details > summary')).toHaveLength(1);
    expect(report.find('.ui-statistics-category-title 安全')).toHaveLength(0);
    expect(report.find('.ui-statistics-notice').text()).toContain('収集開始日');
    expect(html).toContain(statisticsFeedUrls.rss);
    const saved = await fs.readFile(path.join(output, 'state.json'), 'utf-8');
    expect(saved).not.toContain(item.link);
    expect(saved).not.toContain(item.title);
  });

  it('再実行と遅延取得で同じGUID・公開日時を保持する', async () => {
    await generateStatistics([item], sections, published, output, firstTime);
    await generateStatistics([], sections, published, output, nextDay);
    const initialRss = await fs.readFile(path.join(output, 'rss.xml'), 'utf-8');
    await generateStatistics([item], sections, published, output, new Date('2026-09-27T16:00:00.000Z'));
    expect(await fs.readFile(path.join(output, 'rss.xml'), 'utf-8')).toBe(initialRss);
    await generateStatistics(
      [{ ...item, link: 'https://example.com/late' }],
      sections,
      published,
      output,
      new Date('2026-09-27T17:00:00.000Z'),
    );
    const parser = new RssParser();
    const first = await parser.parseString(initialRss);
    const next = await parser.parseString(await fs.readFile(path.join(output, 'rss.xml'), 'utf-8'));
    expect(next.items).toHaveLength(1);
    expect(next.items[0].guid).toBe(first.items[0].guid);
    expect(next.items[0].pubDate).toBe(first.items[0].pubDate);
    expect(next.items[0]['content:encoded']).toContain('2件');
  });

  it('内容が500文字を超えても全カテゴリを配信する', async () => {
    const categories = Array.from({ length: 40 }, (_, index) => ({
      id: `category-${index}`,
      title: `カテゴリ ${index}`,
    }));
    const articles = categories.map((section) => ({ ...item, sectionId: section.id }));
    await generateStatistics(articles, categories, published, output, firstTime);
    const state = await generateStatistics([], categories, published, output, nextDay);
    const json = JSON.parse(await fs.readFile(path.join(output, 'feed.json'), 'utf-8'));
    expect(json.items[0].content_html.length).toBeGreaterThan(500);
    for (const section of categories) expect(json.items[0].content_html).toContain(section.title);
    const page = load(renderStatisticsPage({ page: { url: '/statistics/daily/' }, statistics: state }));
    expect(page('.ui-statistics-categories')).toHaveLength(2);
    expect(page('.ui-statistics-category')).toHaveLength(40);
    expect(
      page('.ui-statistics-category-title')
        .map((_, element) => page(element).text())
        .get(),
    ).toEqual(state.reports[0].categories.map((category) => category.title));
    expect(page('.ui-statistics-metrics dd').first().text()).toBe('40件');
  });

  it('公開済み履歴をキャッシュより優先する', async () => {
    await generateStatistics([item], sections, published, output, firstTime);
    await fs.cp(output, published, { recursive: true });
    await fs.rm(output, { recursive: true });
    await generateStatistics([], sections, path.join(directory, 'absent'), output, nextDay);
    const restored = await generateStatistics([], sections, published, output, nextDay);
    expect(restored.startedAt).toBe(firstTime.toISOString());
    expect(restored.reports[0].categories[0].count).toBe(1);
  });

  it('公開後の未公開取得分を同じ収集履歴のキャッシュから保持する', async () => {
    await generateStatistics([item], sections, published, output, firstTime);
    await fs.cp(output, published, { recursive: true });
    await generateStatistics(
      [{ ...item, link: 'https://example.com/unpublished' }],
      sections,
      published,
      output,
      new Date('2026-09-27T02:00:00.000Z'),
    );
    const state = await generateStatistics([], sections, published, output, nextDay);
    expect(state.reports[0].categories[0].count).toBe(2);
    const rss = await fs.readFile(path.join(output, 'rss.xml'), 'utf-8');
    await generateStatistics([], sections, published, output, new Date('2026-09-27T16:00:00.000Z'));
    expect(await fs.readFile(path.join(output, 'rss.xml'), 'utf-8')).toBe(rss);
  });

  it('壊れた公開履歴は正常なキャッシュから復元する', async () => {
    await generateStatistics([item], sections, published, output, firstTime);
    await fs.mkdir(published, { recursive: true });
    await fs.writeFile(path.join(published, 'state.json'), '{}');
    const restored = await generateStatistics([], sections, published, output, nextDay);
    expect(restored.reports[0].categories[0].count).toBe(1);
  });

  it('復元不能な履歴を空の統計で上書きしない', async () => {
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'state.json'), '{broken');
    await expect(generateStatistics([], sections, published, output, nextDay)).rejects.toThrow('復元');
    expect(await fs.readFile(path.join(output, 'state.json'), 'utf-8')).toBe('{broken');
    await expect(fs.access(path.join(output, 'rss.xml'))).rejects.toThrow();
  });

  it('履歴へのシンボリックリンクを拒否する', async () => {
    await generateStatistics([item], sections, published, output, firstTime);
    await fs.mkdir(published, { recursive: true });
    await fs.symlink(path.join(output, 'state.json'), path.join(published, 'state.json'));
    await expect(readStatisticsState(published)).rejects.toThrow('不正');
  });
});
