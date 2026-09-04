import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CustomRssParserFeed, OgObjectMap } from '../src/feed/feed-crawler';
import { type BlogFeed, FeedStorer } from '../src/feed/feed-storer';

const temporaryDirectories: string[] = [];

const createFeed = (): CustomRssParserFeed => {
  return {
    title: 'Example Tech Blog',
    link: 'https://example.com/',
    items: [
      {
        title: 'テスト記事',
        link: 'https://example.com/article',
        isoDate: '2026-06-09T04:03:10.000Z',
      },
    ],
  } as CustomRssParserFeed;
};

const storeBlogFeeds = async (feed: CustomRssParserFeed, ogObjectMap: OgObjectMap): Promise<BlogFeed[]> => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'feed-storer-'));
  temporaryDirectories.push(temporaryDirectory);

  const articleDirectory = path.join(temporaryDirectory, 'feeds');
  const blogDirectory = path.join(temporaryDirectory, 'blogs');
  await new FeedStorer().storeFeeds(
    { atom: '', rss: '', json: '' },
    articleDirectory,
    [feed],
    ogObjectMap,
    new Map(),
    blogDirectory,
  );

  return JSON.parse(await fs.readFile(path.join(blogDirectory, 'blog-feeds.json'), 'utf-8')) as BlogFeed[];
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true })));
});

describe('FeedStorer', () => {
  it('署名・認証情報を含む画像URLはブログ別データに出力しない', async () => {
    const feed = createFeed();
    const ogObjectMap = new Map([
      [
        feed.link,
        {
          customOgImage: { url: 'https://example.com/blog.png?token=example' },
        },
      ],
      [
        feed.items[0].link,
        {
          customOgImage: { url: 'https://example.com/article.png?X-Goog-Signature=example' },
        },
      ],
    ]) as OgObjectMap;
    const storedFeeds = await storeBlogFeeds(feed, ogObjectMap);
    expect(storedFeeds[0].ogImageUrl).toBe('');
    expect(storedFeeds[0].items[0].ogImageUrl).toBe('');
  });

  it('通常のクエリパラメーターを持つ画像URLはブログ別データに出力する', async () => {
    const feed = createFeed();
    const blogImageUrl = 'https://example.com/blog.png?width=1200';
    const articleImageUrl = 'https://example.com/article.png?format=webp';
    const ogObjectMap = new Map([
      [feed.link, { customOgImage: { url: blogImageUrl } }],
      [feed.items[0].link, { customOgImage: { url: articleImageUrl } }],
    ]) as OgObjectMap;

    const storedFeeds = await storeBlogFeeds(feed, ogObjectMap);

    expect(storedFeeds[0].ogImageUrl).toBe(blogImageUrl);
    expect(storedFeeds[0].items[0].ogImageUrl).toBe(articleImageUrl);
  });
});
