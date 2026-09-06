import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CustomOgObject, type CustomRssParserFeed, FeedCrawler } from '../src/feed/feed-crawler';
import { logger } from '../src/feed/logger';
import type { FeedInfo } from '../src/resources/feed-info-list';

type FeedCrawlerPostProcessor = {
  postProcessFeed(feedInfo: FeedInfo, feed: CustomRssParserFeed): CustomRssParserFeed;
};

type FeedCrawlerOgNormalizer = {
  normalizeOgObject(url: string, ogObject: CustomOgObject): CustomOgObject;
};

type FeedCrawlerSourceFetcher = {
  fetchSourceFeed(feedInfo: FeedInfo): Promise<CustomRssParserFeed>;
};

const postProcessFeed = (feedInfo: FeedInfo, feed: CustomRssParserFeed): CustomRssParserFeed => {
  return (FeedCrawler as unknown as FeedCrawlerPostProcessor).postProcessFeed(feedInfo, feed);
};

const normalizeOgObject = (url: string, ogObject: CustomOgObject): CustomOgObject => {
  return (FeedCrawler as unknown as FeedCrawlerOgNormalizer).normalizeOgObject(url, ogObject);
};

const fetchSourceFeed = (crawler: FeedCrawler, feedInfo: FeedInfo): Promise<CustomRssParserFeed> => {
  return (crawler as unknown as FeedCrawlerSourceFetcher).fetchSourceFeed(feedInfo);
};

beforeEach(() => {
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FeedCrawler', () => {
  it('生成フィードはHTTP取得せず内部レジストリのXMLを解析する', async () => {
    const feedInfo: FeedInfo = {
      label: '生成ブログ',
      url: 'https://example.com/feeds/generated/test/rss.xml',
      pageUrl: 'https://example.com/blog/',
      sectionId: 'engineering',
      input: {
        kind: 'generated',
        id: 'test',
      },
    };
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>生成ブログ</title>
          <link>https://example.com/blog/</link>
          <item>
            <title>記事</title>
            <link>https://example.com/articles/1</link>
            <pubDate>Sat, 05 Sep 2026 12:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;
    const crawler = new FeedCrawler(new Map([['test', rss]]));

    const feed = await fetchSourceFeed(crawler, feedInfo);

    expect(feed.title).toBe('生成ブログ');
    expect(feed.items[0].link).toBe('https://example.com/articles/1');
  });

  it('内部レジストリにない生成フィードはエラーにする', async () => {
    const feedInfo: FeedInfo = {
      label: '生成ブログ',
      url: 'https://example.com/feeds/generated/test/rss.xml',
      sectionId: 'engineering',
      input: {
        kind: 'generated',
        id: 'test',
      },
    };

    await expect(fetchSourceFeed(new FeedCrawler(), feedInfo)).rejects.toThrow('生成フィード「test」を利用できません');
  });

  it('署名付きOG画像を除外し、次の公開可能な画像を採用する', () => {
    const safeImageUrl = 'https://example.com/safe.png?width=1200';
    const ogObject = {
      ogImage: [{ url: 'https://example.com/signed.png?X-Amz-Credential=example' }, { url: safeImageUrl }],
      favicon: 'https://example.com/favicon.ico?token=example',
    } as CustomOgObject;

    const result = normalizeOgObject('https://example.com/article', ogObject);

    expect(result.customOgImage?.url).toBe(safeImageUrl);
    expect(result.favicon).toBeUndefined();
  });

  it('相対パスのOG画像とfaviconを記事URL基準の絶対URLにする', () => {
    const ogObject = {
      ogImage: [{ url: '/images/article.png?width=1200' }],
      favicon: '/favicon.ico',
    } as CustomOgObject;

    const result = normalizeOgObject('https://example.com/articles/1', ogObject);

    expect(result.customOgImage?.url).toBe('https://example.com/images/article.png?width=1200');
    expect(result.favicon).toBe('https://example.com/favicon.ico');
  });

  it('Speaker Deck のカテゴリフィードはカテゴリページをブログURLにする', () => {
    const feedInfo: FeedInfo = {
      label: 'Programming - Speaker Deck',
      url: 'https://speakerdeck.com/c/programming.atom',
      sectionId: 'speakerdeck',
      input: {
        kind: 'remote',
        url: 'https://speakerdeck.com/c/programming.atom',
      },
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

  it('Qiita のタグフィードはタグページをブログURLにする', () => {
    const feedInfo: FeedInfo = {
      label: 'Qiita - AIエージェント',
      url: 'https://qiita.com/tags/AIエージェント/feed',
      sectionId: 'ai',
      input: {
        kind: 'remote',
        url: 'https://qiita.com/tags/AIエージェント/feed',
      },
    };
    const feed = {
      title: 'AIエージェントタグが付けられた新着記事 - Qiita',
      link: 'https://qiita.com',
      items: [
        {
          title: 'テスト記事',
          link: 'https://qiita.com/example/items/test',
          isoDate: '2026-09-05T01:00:00.000Z',
        },
      ],
    } as CustomRssParserFeed;

    const result = postProcessFeed(feedInfo, feed);

    expect(result.link).toBe('https://qiita.com/tags/AIエージェント');
    expect(result.items[0].blogLink).toBe('https://qiita.com/tags/AIエージェント');
  });

  it('creator が author オブジェクトの場合は名前を文字列として扱う', () => {
    const feedInfo: FeedInfo = {
      label: 'Google Cloud',
      url: 'https://cloudblog.withgoogle.com/products/gcp/rss',
      sectionId: 'google-cloud',
      input: {
        kind: 'remote',
        url: 'https://cloudblog.withgoogle.com/products/gcp/rss',
      },
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
      input: {
        kind: 'remote',
        url: 'https://example.com/feed',
      },
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
        {
          title: '認証情報を含む記事',
          link: 'https://example.com/private?token=secret',
          isoDate: '2026-07-25T01:46:08.000Z',
        },
      ],
    } as CustomRssParserFeed;

    const result = postProcessFeed(feedInfo, feed);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].link).toBe('https://example.com/article');
  });

  it('記事識別用クエリを保持し、追跡用クエリだけを除外する', () => {
    const feedInfo: FeedInfo = {
      label: 'テストブログ',
      url: 'https://example.com/feed',
      sectionId: 'engineering',
      input: {
        kind: 'remote',
        url: 'https://example.com/feed',
      },
    };
    const feed = {
      title: 'テストブログ',
      link: 'https://example.com/',
      items: [
        {
          title: '100番の記事',
          link: 'https://example.com/article?id=100&utm_source=rss',
          isoDate: '2026-07-25T01:46:08.000Z',
        },
        {
          title: '101番の記事',
          link: 'https://example.com/article?id=101',
          isoDate: '2026-07-25T01:46:08.000Z',
        },
      ],
    } as CustomRssParserFeed;

    const result = postProcessFeed(feedInfo, feed);

    expect(result.items.map((item) => item.link)).toEqual([
      'https://example.com/article?id=100',
      'https://example.com/article?id=101',
    ]);
  });

  it('記事URLが相対パスならブログURLを基準に絶対URLへ解決する', () => {
    const feedInfo: FeedInfo = {
      label: 'テストブログ',
      url: 'https://example.com/feed',
      sectionId: 'engineering',
      input: {
        kind: 'remote',
        url: 'https://example.com/feed',
      },
    };
    const feed = {
      title: 'テストブログ',
      link: 'https://example.com/blog/',
      items: [
        {
          title: '記事タイトル',
          link: '/articles/1?id=100&utm_source=rss',
          isoDate: '2026-07-25T01:46:08.000Z',
        },
      ],
    } as CustomRssParserFeed;

    const result = postProcessFeed(feedInfo, feed);

    expect(result.items[0].link).toBe('https://example.com/articles/1?id=100');
  });

  it('ブログURLが http / https でなければ空文字にする', () => {
    const feedInfo: FeedInfo = {
      label: 'テストブログ',
      url: 'https://example.com/feed',
      sectionId: 'engineering',
      input: {
        kind: 'remote',
        url: 'https://example.com/feed',
      },
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

  it('ブログURLに認証情報が含まれる場合は空文字にする', () => {
    const feedInfo: FeedInfo = {
      label: 'テストブログ',
      url: 'https://example.com/feed',
      sectionId: 'engineering',
      input: {
        kind: 'remote',
        url: 'https://example.com/feed',
      },
    };
    const feed = {
      title: 'テストブログ',
      link: 'https://example.com/?token=secret',
      items: [],
    } as unknown as CustomRssParserFeed;

    const result = postProcessFeed(feedInfo, feed);

    expect(result.link).toBe('');
  });
});
