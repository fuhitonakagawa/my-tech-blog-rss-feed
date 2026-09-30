import type { CustomRssParserItem } from '../../src/feed/feed-crawler';
import type { TranslationLimits } from '../../src/feed/translation/translator';

export const testTranslationLimits: TranslationLimits = {
  totalTimeoutMs: 60_000,
  batchTimeoutMs: 5000,
  maxBatchTexts: 8,
  maxBatchBytes: 4096,
  maxTextBytes: 2048,
};

/** 元記事情報を持つ英語記事を返す */
export const makeSourceItem = (overrides: Partial<CustomRssParserItem> = {}): CustomRssParserItem => ({
  title: 'New API',
  summary: 'Build apps',
  link: 'https://example.com/article',
  guid: 'source-guid',
  isoDate: '2026-09-20T12:00:00.000Z',
  creator: 'Author',
  categories: ['API'],
  blogTitle: 'Source Blog',
  blogLink: 'https://example.com/',
  sectionId: 'ai',
  sourceLanguage: 'en',
  ...overrides,
});
