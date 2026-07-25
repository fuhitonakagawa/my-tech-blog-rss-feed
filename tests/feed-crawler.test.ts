import { describe, expect, it } from 'vitest';
import { type CustomRssParserFeed, FeedCrawler } from '../src/feed/feed-crawler';
import type { FeedInfo } from '../src/resources/feed-info-list';

type FeedCrawlerPostProcessor = {
  postProcessFeed(feedInfo: FeedInfo, feed: CustomRssParserFeed): CustomRssParserFeed;
};

const postProcessFeed = (feedInfo: FeedInfo, feed: CustomRssParserFeed): CustomRssParserFeed => {
  return (FeedCrawler as unknown as FeedCrawlerPostProcessor).postProcessFeed(feedInfo, feed);
};

describe('FeedCrawler', () => {
  it('Speaker Deck のカテゴリフィードはカテゴリページをブログURLにする', () => {
    const feedInfo: FeedInfo = {
      label: 'Programming - Speaker Deck',
      url: 'https://speakerdeck.com/c/programming.atom',
      sectionId: 'speakerdeck',
    };
    const feed = {
      title: 'Programming - Speaker Deck',
      link: 'https://speakerdeck.com',
      items: [
        {
          title: 'テストスライド',
          link: 'https://speakerdeck.com/example/test-slide',
          isoDate: '2026-07-25T01:46:08.000Z',
        },
      ],
    } as CustomRssParserFeed;

    const result = postProcessFeed(feedInfo, feed);

    expect(result.link).toBe('https://speakerdeck.com/c/programming');
    expect(result.items[0].blogLink).toBe('https://speakerdeck.com/c/programming');
  });
});
