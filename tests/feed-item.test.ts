import { describe, expect, it } from 'vitest';
import { renderFeedItem } from '../src/site/_includes/components/feed-item';
import { makeFeedJsonItem } from './helpers/site-data-fixtures';

const page = { url: '/' };

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
