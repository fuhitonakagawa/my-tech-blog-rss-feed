import { describe, expect, it } from 'vitest';
import { normalizeArticleUrl, removeInvalidUnicode } from '../src/feed/common-util';

describe('normalizeArticleUrl', () => {
  it('記事識別に必要なクエリパラメーターを保持する', () => {
    expect(normalizeArticleUrl('https://example.com/article?id=100')).toBe('https://example.com/article?id=100');
    expect(normalizeArticleUrl('https://example.com/article?id=101')).toBe('https://example.com/article?id=101');
  });

  it('追跡用クエリパラメーターとフラグメントだけを除外する', () => {
    expect(normalizeArticleUrl('https://example.com/article?id=100&utm_source=rss&fbclid=test#heading')).toBe(
      'https://example.com/article?id=100',
    );
  });

  it('URLとして解釈できない値は変更しない', () => {
    expect(normalizeArticleUrl('not-a-url')).toBe('not-a-url');
  });

  it.each([
    'https://docs.cloud.google.com/release-notes#September_29_2026',
    'https://cloud.google.com/release-notes#September_28_2026',
    'https://docs.cloud.google.com/bigquery/docs/release-notes#January_01_2026',
    'https://cloud.google.com/compute/docs/release-notes/#December_9_2026',
  ])('リリースノートの日付アンカーを追跡情報の除去後も保持する: %s', (url) => {
    const tracked = new URL(url);
    tracked.search = '?utm_source=rss&fbclid=test';
    expect(normalizeArticleUrl(url)).toBe(url);
    expect(normalizeArticleUrl(tracked.href)).toBe(url);
  });

  it.each([
    'https://docs.cloud.google.com/release-notes#heading',
    'https://example.com/release-notes#September_29_2026',
    'https://docs.cloud.google.com.example.com/release-notes#September_29_2026',
    'https://docs.cloud.google.com/blog/article#September_29_2026',
  ])('通常の見出しアンカーは重複判定から除外する: %s', (url) => {
    expect(normalizeArticleUrl(url)).toBe(url.split('#')[0]);
  });
});

describe('removeInvalidUnicode', () => {
  it('不正なUnicode文字を除去', () => {
    const str = 'a\u{000b}b';
    const result = removeInvalidUnicode(str);
    expect(result).toEqual('ab');
  });

  it('正常な文字列を変更しない', () => {
    const str = 'こんにちは, 今日は, hello, 你好, 안녕하세요, สวัสดีครับ.';
    const result = removeInvalidUnicode(str);
    expect(result).toEqual(str);
  });

  it('空文字列を変更しない', () => {
    const str = '';
    const result = removeInvalidUnicode(str);
    expect(result).toEqual(str);
  });

  it('スペースを削除しない', () => {
    const str = ' ,　';
    const result = removeInvalidUnicode(str);
    expect(result).toEqual(str);
  });

  it('絵文字は削除しない', () => {
    const str = 'Hello, 😀world!😁';
    const result = removeInvalidUnicode(str);
    expect(result).toEqual(str);
  });
});
