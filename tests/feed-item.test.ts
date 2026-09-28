import { afterEach, describe, expect, it, vi } from 'vitest';
import * as eleventyUtils from '../src/common/eleventy-utils';
import { renderFeedItem } from '../src/site/_includes/components/feed-item';
import { makeFeedJsonItem } from './helpers/site-data-fixtures';

const page = { url: '/' };
afterEach(() => vi.restoreAllMocks());

describe('renderFeedItem', () => {
  it('記事URLを href に出力する', async () => {
    const feedItem = makeFeedJsonItem('2026-07-25T01:46:08.000Z', 0, { url: 'https://example.com/article' });

    const html = await renderFeedItem(feedItem, page, 'lazy');

    expect(html).toContain("href='https://example.com/article'");
  });

  it('記事URLが http / https でなければ href を空にする', async () => {
    const feedItem = makeFeedJsonItem('2026-07-25T01:46:08.000Z', 0, {
      url: 'javascript:alert(document.domain)',
    });

    const html = await renderFeedItem(feedItem, page, 'lazy');

    expect(html).not.toContain('javascript:');
    expect(html).toContain("href=''");
  });
});

it('翻訳タイトルと概要を画面へ一度だけエスケープする', async () => {
  const item = makeFeedJsonItem('2026-07-25T01:46:08.000Z', 0, {
    summary: '概要 & <script>alert(1)</script>',
    content_html: '概要 &amp; &lt;script&gt;alert(1)&lt;/script&gt;',
  });
  item._custom.originalTitle = 'Original & Title';
  item._custom.translatedTitle = '翻訳 & <API>';
  const html = await renderFeedItem(item, page, 'lazy');
  expect(html).toContain('翻訳 &amp; &lt;API&gt;');
  expect(html).toContain('概要 &amp; &lt;script&gt;alert(1)&lt;/script&gt;');
  expect(html).not.toContain('&amp;amp;');
  expect(html).not.toContain('<script>alert(1)</script>');
});

it('JSON Feedの画像URL文字列をサムネイル処理へ渡す', async () => {
  const thumbnail = vi.spyOn(eleventyUtils, 'imageThumbnailShortcode').mockResolvedValue('<img alt="記事画像">');
  const item = makeFeedJsonItem('2026-07-25T01:46:08.000Z', 0, { image: 'https://example.com/image.png' });
  const html = await renderFeedItem(item, page, 'lazy');
  expect(thumbnail).toHaveBeenCalledWith(
    'https://example.com/image.png',
    '記事のアイキャッチ画像',
    expect.any(String),
    'lazy',
  );
  expect(html).toContain('<img alt="記事画像">');
});
