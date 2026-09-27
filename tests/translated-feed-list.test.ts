import { describe, expect, it } from 'vitest';
import { FEED_INFO_LIST, FEED_SECTION_LIST } from '../src/resources/feed-info-list';
import { parseFeedLanguage } from '../src/resources/feed-language';
import {
  DISPLAY_SECTION_LIST,
  TRANSLATED_FEED_DEFINITION_LIST,
  parseTranslatedFeedFile,
  parseTranslatedFeeds,
} from '../src/resources/translated-feed-list';

describe('翻訳対象の定義', () => {
  it('通常フィードと生成フィードの英語指定を解決する', () => {
    const ai = FEED_INFO_LIST.filter((feed) => feed.sectionId === 'ai');
    expect(ai).toHaveLength(20);
    expect(ai.every((feed) => feed.language === 'en')).toBe(true);
    const aws = FEED_INFO_LIST.filter((feed) => feed.sectionId === 'aws');
    expect(aws.filter((feed) => feed.language === 'en')).toHaveLength(44);
    expect(aws.filter((feed) => feed.url.includes('/jp/')).every((feed) => feed.language === 'ja')).toBe(true);
    expect(
      FEED_INFO_LIST.filter((feed) => feed.sectionId === 'zenn').every((feed) => feed.language === 'unknown'),
    ).toBe(true);
  });

  it('未指定と不正な言語を区別する', () => {
    expect(parseFeedLanguage(undefined)).toBe('unknown');
    expect(parseFeedLanguage('mixed')).toBe('mixed');
    expect(() => parseFeedLanguage('EN')).toThrow('language');
  });

  it('派生フィードを取得元リストに含めず表示先だけに含める', () => {
    expect(TRANSLATED_FEED_DEFINITION_LIST).toHaveLength(12);
    expect(FEED_SECTION_LIST.some((section) => section.id === 'ai-jp')).toBe(false);
    expect(DISPLAY_SECTION_LIST.some((section) => section.id === 'ai-jp')).toBe(true);
    expect(DISPLAY_SECTION_LIST.find((section) => section.id === 'ai')?.feedDirectory).toBe('section-feeds');
    expect(DISPLAY_SECTION_LIST.find((section) => section.id === 'ai-jp')?.feedDirectory).toBe('translated-feeds');
  });

  it('翻訳定義のIDをファイル名から読み込む', () => {
    const value = { title: 'AI-translated-jp', sourceSectionId: 'ai', sourceLanguage: 'en', targetLanguage: 'ja' };
    expect(parseTranslatedFeedFile('ai-jp.json', value)).toEqual({ ...value, id: 'ai-jp' });
    expect(() => parseTranslatedFeedFile('ai-jp.json', { ...value, id: 'other' })).toThrow('ファイル名');
    expect(() => parseTranslatedFeedFile('../ai-jp.json', value)).toThrow('ファイル名');
    expect(() => parseTranslatedFeedFile('ai-jp.json', [value])).toThrow('オブジェクト');
  });

  it.each([{ id: '../escape' }, { id: 'ai' }, { sourceSectionId: 'missing' }, { targetLanguage: 'en' }, { title: '' }])(
    '不正な参照や衝突する定義を拒否する: %o',
    (overrides) => {
      const definition = {
        id: 'ai-jp',
        title: 'AI-translated-jp',
        sourceSectionId: 'ai',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        ...overrides,
      };
      expect(() => parseTranslatedFeeds([definition], FEED_SECTION_LIST)).toThrow();
    },
  );

  it('同じカテゴリの派生を重複定義できない', () => {
    const definition = TRANSLATED_FEED_DEFINITION_LIST[0];
    expect(() => parseTranslatedFeeds([definition, { ...definition, id: 'ai-other' }], FEED_SECTION_LIST)).toThrow(
      '重複',
    );
  });
});
