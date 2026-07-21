import { describe, expect, it } from 'vitest';
import type { CustomRssParserItem, OgObjectMap } from '../src/feed/feed-crawler';
import { type AggregatedFeedMeta, FeedGenerator } from '../src/feed/feed-generator';

const testFeedMeta: AggregatedFeedMeta = {
  title: 'テストフィード',
  description: 'テスト用のまとめフィード',
  pageUrl: 'https://example.com/test-section/',
  feedUrls: {
    atom: 'https://example.com/test-section/feeds/atom.xml',
    rss: 'https://example.com/test-section/feeds/rss.xml',
    json: 'https://example.com/test-section/feeds/feed.json',
  },
};

describe('FeedGenerator', () => {
  it('不正なOG画像URLは画像なしとしてフィード生成できる', () => {
    const feedItem = {
      title: 'テスト記事',
      link: 'https://example.com/test-article/',
      guid: 'https://example.com/?p=1',
      isoDate: '2026-06-09T04:03:10.000Z',
      blogTitle: 'Example Tech Blog',
      blogLink: 'https://example.com',
    } as CustomRssParserItem;
    const ogObjectMap = new Map([
      [
        feedItem.link,
        {
          // ホスト名に %20 を含むURLは new URL() が throw する
          customOgImage: {
            url: 'http://Invalid%20Og%20Image',
          },
        },
      ],
    ]) as OgObjectMap;
    const feedGenerator = new FeedGenerator();

    const result = feedGenerator.generateFeeds([feedItem], ogObjectMap, new Map(), 200, 500, testFeedMeta);

    expect(result.aggregatedFeed.items[0].image).toBeUndefined();
    expect(result.feedDistributionSet.atom).toContain('<feed');
  });

  it('guidが属性付き要素でオブジェクトになっている場合はリンクをIDに使う', () => {
    const feedItem = {
      title: 'テスト記事',
      link: 'https://example.com/test-article/',
      // rss-parser は `<guid isPermaLink="false"/>` をオブジェクトとして返す
      guid: { $: { isPermaLink: 'false' } } as unknown as string,
      isoDate: '2026-06-09T04:03:10.000Z',
      blogTitle: 'Example Tech Blog',
      blogLink: 'https://example.com',
    } as CustomRssParserItem;
    const feedGenerator = new FeedGenerator();

    const result = feedGenerator.generateFeeds([feedItem], new Map(), new Map(), 200, 500, testFeedMeta);

    expect(result.aggregatedFeed.items[0].id).toBe(feedItem.link);
    expect(result.feedDistributionSet.atom).toContain('<feed');
  });

  it('メタ情報がフィードのタイトル・リンクに反映される', () => {
    const feedItem = {
      title: 'テスト記事',
      link: 'https://example.com/test-article/',
      isoDate: '2026-06-09T04:03:10.000Z',
      blogTitle: 'Example Tech Blog',
      blogLink: 'https://example.com',
    } as CustomRssParserItem;
    const feedGenerator = new FeedGenerator();

    const result = feedGenerator.generateFeeds([feedItem], new Map(), new Map(), 200, 500, testFeedMeta);

    expect(result.aggregatedFeed.options.title).toBe(testFeedMeta.title);
    expect(result.aggregatedFeed.options.link).toBe(testFeedMeta.pageUrl);
    expect(result.feedDistributionSet.atom).toContain('https://example.com/test-section/feeds/atom.xml');
  });
});
