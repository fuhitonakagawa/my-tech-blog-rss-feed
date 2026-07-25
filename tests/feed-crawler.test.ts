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

  it('creator が author オブジェクトの場合は名前を文字列として扱う', () => {
    const feedInfo: FeedInfo = {
      label: 'Google Cloud',
      url: 'https://cloudblog.withgoogle.com/products/gcp/rss',
      sectionId: 'google-cloud',
    };
    const feed = {
      title: 'Google Cloud',
      link: 'https://cloud.google.com/blog/products/gcp/',
      items: [
        {
          title: 'What’s new with Google Cloud',
          link: 'https://cloud.google.com/blog/topics/inside-google-cloud/whats-new-google-cloud/',
          isoDate: '2026-07-24T16:00:00.000Z',
          creator: {
            name: ['Google Cloud Content & Editorial '],
          },
        },
      ],
    } as unknown as CustomRssParserFeed;

    const result = postProcessFeed(feedInfo, feed);

    expect(result.items[0].creator).toBe('Google Cloud Content & Editorial ');
    expect(result.items[0].sectionId).toBe('google-cloud');
  });
});
