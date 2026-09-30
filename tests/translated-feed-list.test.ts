import { describe, expect, it } from 'vitest';
import { DISPLAY_SECTION_LIST } from '../src/resources/display-section-list';
import { FEED_INFO_LIST, FEED_SECTION_LIST } from '../src/resources/feed-info-list';
import { parseFeedLanguage } from '../src/resources/feed-language';
import {
  TRANSLATED_FEED_DEFINITION_LIST,
  parseTranslatedFeedFile,
  parseTranslatedFeeds,
} from '../src/resources/translated-feed-list';

describe('翻訳対象の定義', () => {
  it('通常フィードと生成フィードの英語指定を解決する', () => {
    const ai = FEED_INFO_LIST.filter((feed) => feed.sectionId === 'my-tech-blog-ai');
    expect(ai).toHaveLength(20);
    expect(ai.every((feed) => feed.language === 'en')).toBe(true);
    const aws = FEED_INFO_LIST.filter((feed) => feed.sectionId === 'aws');
    expect(aws).toHaveLength(44);
    expect(aws.every((feed) => feed.language === 'en')).toBe(true);
    const awsJapanese = FEED_INFO_LIST.filter((feed) => feed.sectionId === 'aws-ja');
    expect(awsJapanese).toHaveLength(2);
    expect(awsJapanese.every((feed) => feed.language === 'ja' && feed.url.includes('/jp/'))).toBe(true);
    const googleCloudJapanese = FEED_INFO_LIST.filter((feed) => feed.sectionId === 'google-cloud-ja');
    expect(googleCloudJapanese).toHaveLength(1);
    expect(googleCloudJapanese.every((feed) => feed.language === 'ja')).toBe(true);
    expect(
      FEED_INFO_LIST.filter((feed) => feed.sectionId === 'google-cloud').every((feed) => feed.language === 'en'),
    ).toBe(true);
    const securityEnglish = FEED_INFO_LIST.filter((feed) => feed.sectionId === 'security-en');
    expect(securityEnglish).toHaveLength(3);
    expect(securityEnglish.every((feed) => feed.language === 'en')).toBe(true);
    expect(FEED_INFO_LIST.some((feed) => feed.sectionId === 'security' && feed.language === 'en')).toBe(false);
    expect(TRANSLATED_FEED_DEFINITION_LIST.find((feed) => feed.id === 'security-jp')?.sourceSectionId).toBe(
      'security-en',
    );
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
    expect(TRANSLATED_FEED_DEFINITION_LIST).toHaveLength(13);
    expect(FEED_SECTION_LIST.some((section) => section.id === 'ai-jp')).toBe(false);
    expect(DISPLAY_SECTION_LIST.some((section) => section.id === 'ai-jp')).toBe(true);
    expect(DISPLAY_SECTION_LIST.find((section) => section.id === 'my-tech-blog-ai')?.feedDirectory).toBe(
      'section-feeds',
    );
    expect(DISPLAY_SECTION_LIST.find((section) => section.id === 'ai-jp')?.feedDirectory).toBe('translated-feeds');
  });

  it('翻訳定義のIDをファイル名から読み込む', () => {
    const value = {
      title: 'AI - Translated Japanese',
      sourceSectionId: 'my-tech-blog-ai',
      sourceLanguage: 'en',
      targetLanguage: 'ja',
    };
    expect(parseTranslatedFeedFile('ai-jp.json', value)).toEqual({ ...value, id: 'ai-jp' });
    expect(() => parseTranslatedFeedFile('ai-jp.json', { ...value, id: 'other' })).toThrow('ファイル名');
    expect(() => parseTranslatedFeedFile('../ai-jp.json', value)).toThrow('ファイル名');
    expect(() => parseTranslatedFeedFile('ai-jp.json', [value])).toThrow('オブジェクト');
  });

  it.each([
    { id: '../escape' },
    { id: 'my-tech-blog-ai' },
    { sourceSectionId: 'missing' },
    { targetLanguage: 'en' },
    { title: '' },
  ])('不正な参照や衝突する定義を拒否する: %o', (overrides) => {
    const definition = {
      id: 'ai-jp',
      title: 'AI - Translated Japanese',
      sourceSectionId: 'my-tech-blog-ai',
      sourceLanguage: 'en',
      targetLanguage: 'ja',
      ...overrides,
    };
    expect(() => parseTranslatedFeeds([definition], FEED_SECTION_LIST)).toThrow();
  });

  it('同じカテゴリの派生を重複定義できない', () => {
    const definition = TRANSLATED_FEED_DEFINITION_LIST[0];
    expect(() => parseTranslatedFeeds([definition, { ...definition, id: 'ai-other' }], FEED_SECTION_LIST)).toThrow(
      '重複',
    );
  });
});
