import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractCssGeneratedFeedItems } from '../src/feed/generated/css-extractor';
import type { CssGeneratedFeedExtractorConfig, GeneratedFeedDefinition } from '../src/feed/generated/types';
import { logger } from '../src/feed/logger';

const extractor: CssGeneratedFeedExtractorConfig = {
  type: 'css',
  itemSelector: 'article',
  titleSelector: 'h2',
  linkSelector: '.article-link',
  dateSelector: '.date',
  dateAttribute: 'datetime',
  timeSelector: '.time',
  timeAttribute: 'datetime',
  timeZoneOffset: '+09:00',
  summarySelector: '.summary',
  categorySelector: '.category',
  creatorSelector: '.creator',
};

const definition: GeneratedFeedDefinition = {
  id: 'test-blog',
  schemaVersion: 1,
  label: 'テストブログ',
  pageUrl: 'https://example.com/blog/',
  language: 'ja',
  extractor,
  pollIntervalMinutes: 60,
  maxItems: 50,
};

const createHtml = (): string => `
  <main>
    <article>
      <a class="article-link" href="/blog/first?id=100&utm_source=test"><h2> 最初の記事 </h2></a>
      <time class="date" datetime="2026-09-05"></time>
      <time class="time" datetime="12:34:56"></time>
      <p class="summary"> 記事の\n概要です。 </p>
      <span class="category">AWS</span>
      <span class="category">Serverless</span>
      <span class="creator">編集部</span>
    </article>
  </main>
`;

beforeEach(() => {
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'trace').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('extractCssGeneratedFeedItems', () => {
  it('CSSセレクターでHTMLから記事を抽出する', () => {
    expect(extractCssGeneratedFeedItems(definition, createHtml(), extractor)).toEqual([
      {
        id: 'https://example.com/blog/first?id=100',
        title: '最初の記事',
        url: 'https://example.com/blog/first?id=100',
        publishedAt: '2026-09-05T03:34:56.000Z',
        summary: '記事の概要です。',
        creator: '編集部',
        categories: ['AWS', 'Serverless'],
      },
    ]);
  });

  it('日付だけの場合は指定タイムゾーンの午前0時として扱う', () => {
    const dateOnlyExtractor = { ...extractor, timeSelector: undefined, timeAttribute: undefined };

    const items = extractCssGeneratedFeedItems(definition, createHtml(), dateOnlyExtractor);

    expect(items[0].publishedAt).toBe('2026-09-04T15:00:00.000Z');
  });

  it('記事要素を取得できない場合はエラーにする', () => {
    expect(() => extractCssGeneratedFeedItems(definition, '<main></main>', extractor)).toThrow(
      '生成フィード「テストブログ」の記事を取得できません',
    );
  });

  it('必須項目を取得できない記事を除外する', () => {
    const html = createHtml().replace('<h2> 最初の記事 </h2>', '');

    expect(() => extractCssGeneratedFeedItems(definition, html, extractor)).toThrow(
      '生成フィード「テストブログ」の有効な記事を取得できません',
    );
  });

  it('公開できない記事URLを除外する', () => {
    const html = createHtml().replace(
      'href="/blog/first?id=100&utm_source=test"',
      'href="https://user:password@example.com/blog/first"',
    );

    expect(() => extractCssGeneratedFeedItems(definition, html, extractor)).toThrow(
      '生成フィード「テストブログ」の有効な記事を取得できません',
    );
  });

  it('記事IDの重複を拒否する', () => {
    const article = createHtml().match(/<article>[\s\S]*<\/article>/)?.[0];
    if (!article) {
      throw new Error('テスト用の記事HTMLがありません');
    }

    expect(() => extractCssGeneratedFeedItems(definition, `<main>${article}${article}</main>`, extractor)).toThrow(
      '記事ID「https://example.com/blog/first?id=100」が重複しています',
    );
  });

  it('解釈できない公開日時はエラーにする', () => {
    const html = createHtml().replace('datetime="2026-09-05"', 'datetime="invalid"');

    expect(() => extractCssGeneratedFeedItems(definition, html, extractor)).toThrow(
      '生成フィード「テストブログ」の有効な記事を取得できません',
    );
  });

  it('存在しない日付はエラーにする', () => {
    const html = createHtml().replace('datetime="2026-09-05"', 'datetime="2026-02-31"');

    expect(() => extractCssGeneratedFeedItems(definition, html, extractor)).toThrow(
      '生成フィード「テストブログ」の有効な記事を取得できません',
    );
  });

  it('不正な記事があっても有効な記事を返す', () => {
    const invalidArticle = createHtml()
      .match(/<article>[\s\S]*<\/article>/)?.[0]
      ?.replace('datetime="2026-09-05"', 'datetime="invalid"');
    if (!invalidArticle) {
      throw new Error('テスト用の記事HTMLがありません');
    }

    const items = extractCssGeneratedFeedItems(definition, `<main>${invalidArticle}${createHtml()}</main>`, extractor);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('最初の記事');
  });
});
