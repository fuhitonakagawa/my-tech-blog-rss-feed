import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import Parser from 'rss-parser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomRssParserItem } from '../../../src/feed/feed-crawler';
import { FeedGenerator } from '../../../src/feed/feed-generator';
import { FeedStorer } from '../../../src/feed/feed-storer';
import { logger } from '../../../src/feed/logger';
import { generateTranslatedFeeds } from '../../../src/feed/translation/translated-feed-generator';
import type { TranslatedFeedDefinition } from '../../../src/resources/translated-feed-list';
import { makeSourceItem } from '../../helpers/translation-fixtures';

const definitions: TranslatedFeedDefinition[] = [
  { id: 'ai-jp', title: 'AI-JP', sourceSectionId: 'ai', sourceLanguage: 'en', targetLanguage: 'ja' },
  { id: 'aws-jp', title: 'AWS-JP', sourceSectionId: 'aws', sourceLanguage: 'en', targetLanguage: 'ja' },
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('generateTranslatedFeeds', () => {
  it('英語記事だけを翻訳し、カテゴリを分離して元の公開日時順で配信する', async () => {
    const items = [
      makeSourceItem({ title: 'Old', link: 'https://example.com/old' }),
      makeSourceItem({ title: 'New', link: 'https://example.com/new', isoDate: '2026-09-21T12:00:00.000Z' }),
      makeSourceItem({ title: 'AWS', sectionId: 'aws', link: 'https://example.com/aws' }),
      makeSourceItem({ title: '日本語', sourceLanguage: 'ja' }),
      makeSourceItem({ title: 'Mixed', sourceLanguage: 'mixed' }),
      makeSourceItem({ title: 'Unknown', sourceLanguage: 'unknown' }),
      makeSourceItem({ title: 'Other section', sectionId: 'zenn' }),
    ];
    const before = structuredClone(items);
    const translateItems = vi.fn(
      async (source: readonly CustomRssParserItem[]): Promise<CustomRssParserItem[]> =>
        source.map((item) => ({ ...item, originalTitle: item.title, title: `翻訳:${item.title}`, summary: '概要' })),
    );
    const result = await generateTranslatedFeeds(items, definitions, new Map(), new Map(), () => ({ translateItems }));
    expect(translateItems).toHaveBeenCalledTimes(1);
    expect(translateItems.mock.calls[0][0].map((item) => item.title)).toEqual(['Old', 'New', 'AWS']);
    const ai = JSON.parse(result.get('ai-jp')?.json ?? '');
    const aws = JSON.parse(result.get('aws-jp')?.json ?? '');
    expect(ai.title).toBe('AI-JP｜企業テックブログRSS');
    expect(result.get('ai-jp')?.rss).toContain('<language>ja</language>');
    expect(ai.items.map((item: { title: string }) => item.title)).toEqual([
      '翻訳:New | Source Blog',
      '翻訳:Old | Source Blog',
    ]);
    expect(ai.items[0]).toMatchObject({
      id: 'source-guid',
      url: items[1].link,
      date_published: items[1].isoDate,
      _custom: {
        originalTitle: 'New',
        translatedTitle: '翻訳:New',
        blogTitle: 'Source Blog',
        blogLink: items[1].blogLink,
      },
    });
    expect(aws.items).toHaveLength(1);
    expect(items).toEqual(before);
    const rss = await new Parser().parseString(result.get('ai-jp')?.rss ?? '');
    expect(rss.items).toHaveLength(2);
    expect(rss.items[0].guid).toBe('source-guid');
    expect(rss.items[0].link).toBe(items[1].link);
  });

  it('翻訳器の初期化失敗でも全記事を原文で配信する', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const results = await generateTranslatedFeeds([makeSourceItem()], definitions, new Map(), new Map(), () => {
      throw new Error('model missing');
    });
    const ai = JSON.parse(results.get('ai-jp')?.json ?? '');
    expect(ai.items[0].title).toBe('New API | Source Blog');
    expect(ai.items[0]._custom.originalTitle).toBe('New API');
  });

  it('対象記事がないカテゴリも空の有効なフィードを出力する', async () => {
    const createService = vi.fn();
    const results = await generateTranslatedFeeds([], definitions, new Map(), new Map(), createService);
    expect(results.size).toBe(2);
    expect(createService).not.toHaveBeenCalled();
    for (const result of results.values()) {
      expect((await new Parser().parseString(result.rss)).items).toEqual([]);
      expect((await new Parser().parseString(result.atom)).items).toEqual([]);
    }
  });

  it('翻訳専用ルートの再生成で通常フィードの内容や保存先を変更しない', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T00:00:00Z'));
    const items = [makeSourceItem()];
    const originalGenerator = new FeedGenerator();
    const meta = {
      title: 'Original',
      description: 'Original',
      pageUrl: 'https://example.com/',
      feedUrls: {
        rss: 'https://example.com/rss.xml',
        atom: 'https://example.com/atom.xml',
        json: 'https://example.com/feed.json',
      },
    };
    const before = originalGenerator.generateFeeds(items, new Map(), new Map(), 200, 500, meta).feedDistributionSet;
    const translated = await generateTranslatedFeeds(items, definitions, new Map(), new Map(), () => ({
      translateItems: async (source) => source.map((item) => ({ ...item, originalTitle: item.title, title: '翻訳' })),
    }));
    const after = originalGenerator.generateFeeds(items, new Map(), new Map(), 200, 500, meta).feedDistributionSet;
    expect(after).toEqual(before);
    expect(after.json).not.toContain('translatedTitle');
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'translated-output-'));
    try {
      const storer = new FeedStorer();
      const sectionsDirectory = path.join(directory, 'section-feeds');
      const translatedDirectory = path.join(directory, 'translated-feeds');
      await storer.storeSectionFeeds(new Map([['ai', before]]), sectionsDirectory);
      await storer.storeSectionFeeds(translated, translatedDirectory);
      expect(await fs.readdir(sectionsDirectory)).toEqual(['ai']);
      expect((await fs.readdir(translatedDirectory)).sort()).toEqual(['ai-jp', 'aws-jp']);
      expect(await fs.readFile(path.join(translatedDirectory, 'ai-jp/feeds/rss.xml'), 'utf-8')).toBe(
        translated.get('ai-jp')?.rss,
      );
      await storer.storeSectionFeeds(new Map(), translatedDirectory);
      await expect(fs.access(translatedDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await fs.readFile(path.join(sectionsDirectory, 'ai/feeds/rss.xml'), 'utf-8')).toBe(before.rss);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
