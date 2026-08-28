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

  it('記事URLが http / https でない記事を取り込まない', () => {
    const feedInfo: FeedInfo = {
      label: 'テストブログ',
      url: 'https://example.com/feed',
      sectionId: 'engineering',
    };
    const feed = {
      title: 'テストブログ',
      link: 'https://example.com/',
      items: [
        {
          title: '正常な記事',
          link: 'https://example.com/article',
          isoDate: '2026-07-25T01:46:08.000Z',
        },
        {
          title: 'スクリプトを仕込んだ記事',
          link: 'javascript:alert(document.domain)',
          isoDate: '2026-07-25T01:46:08.000Z',
        },
      ],
    } as CustomRssParserFeed;

    const result = postProcessFeed(feedInfo, feed);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].link).toBe('https://example.com/article');
  });

  it('記事URLが相対パスならブログURLを基準に絶対URLへ解決する', () => {
    const feedInfo: FeedInfo = {
      label: 'テストブログ',
      url: 'https://example.com/feed',
      sectionId: 'engineering',
    };
    const feed = {
      title: 'テストブログ',
      link: 'https://example.com/blog/',
      items: [
        {
          title: '記事タイトル',
          link: '/articles/1',
          isoDate: '2026-07-25T01:46:08.000Z',
        },
      ],
    } as CustomRssParserFeed;

    const result = postProcessFeed(feedInfo, feed);

    expect(result.items[0].link).toBe('https://example.com/articles/1');
  });

  it('ブログURLが http / https でなければ空文字にする', () => {
    const feedInfo: FeedInfo = {
      label: 'テストブログ',
      url: 'https://example.com/feed',
      sectionId: 'engineering',
    };
    const feed = {
      title: 'テストブログ',
      link: 'javascript:alert(document.domain)',
      items: [
        {
          title: '記事タイトル',
          link: 'https://example.com/article',
          isoDate: '2026-07-25T01:46:08.000Z',
        },
      ],
    } as CustomRssParserFeed;

    const result = postProcessFeed(feedInfo, feed);

    expect(result.link).toBe('');
    expect(result.items[0].blogLink).toBe('');
  });
});
