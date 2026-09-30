import { expect, it } from 'vitest';
import { mergeRecoveredItems, parseRecoveredArticles, recoveredFeedItems } from '../../src/feed/recovered-articles';
import type { FeedInfo } from '../../src/resources/feed-info-list';

const info: FeedInfo = {
  label: 'Mercari',
  url: 'https://engineering.mercari.com/blog/feed.xml',
  input: { kind: 'remote', url: 'https://engineering.mercari.com/blog/feed.xml' },
  sectionId: 'my-tech-blog-jp',
  language: 'unknown',
};
it('確認済み記事を元カテゴリへ戻し、公開日を保持して期間外は再送しない', () => {
  const items = recoveredFeedItems(info, new Date('2026-09-30T12:00:00Z'));
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    sectionId: 'my-tech-blog-jp',
    isoDate: '2026-09-30T05:54:45.000Z',
    sourceFeedUrl: info.url,
  });
  expect(recoveredFeedItems(info, new Date('2026-10-10T12:00:00Z'))).toEqual([]);
  const feed = {
    title: 'Original',
    link: 'https://engineering.mercari.com/',
    sectionId: info.sectionId,
    items: [{ ...items[0], summary: '元RSSの本文' }],
  };
  mergeRecoveredItems(feed, items);
  expect(feed.items).toHaveLength(1);
  expect(feed.items[0].summary).toBe('元RSSの本文');
});
it('不正なURL・日付と重複した復旧定義を拒否する', () => {
  const item = {
    sourceFeedUrl: info.url,
    url: 'https://example.com/article',
    title: 'Title',
    publishedAt: '2026-09-30T00:00:00.000Z',
  };
  expect(() => parseRecoveredArticles([{ ...item, url: 'https://example.com/?token=secret' }])).toThrow();
  expect(() => parseRecoveredArticles([{ ...item, publishedAt: '2026-02-30' }])).toThrow();
  expect(() => parseRecoveredArticles([item, item])).toThrow('重複');
});
