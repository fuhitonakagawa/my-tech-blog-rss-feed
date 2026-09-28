import { XMLValidator } from 'fast-xml-parser';
import RssParser from 'rss-parser';
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

  it('署名・認証情報を含む画像URLはフィードに出力しない', () => {
    const feedItem = {
      title: 'テスト記事',
      link: 'https://example.com/test-article/',
      isoDate: '2026-06-09T04:03:10.000Z',
      blogTitle: 'Example Tech Blog',
      blogLink: 'https://example.com',
    } as CustomRssParserItem;
    const ogObjectMap = new Map([
      [
        feedItem.link,
        {
          customOgImage: {
            url: 'https://example.com/image.png?X-Amz-Credential=example',
          },
          favicon: 'https://example.com/favicon.ico?access_token=example',
        },
      ],
    ]) as OgObjectMap;
    const feedGenerator = new FeedGenerator();

    const result = feedGenerator.generateFeeds([feedItem], ogObjectMap, new Map(), 200, 500, testFeedMeta);

    expect(result.aggregatedFeed.items[0].image).toBeUndefined();
    for (const feedOutput of Object.values(result.feedDistributionSet)) {
      expect(feedOutput).not.toContain('X-Amz-Credential');
      expect(feedOutput).not.toContain('access_token');
    }
  });

  it('公開可能なOG画像URLと画像データ形式のfaviconはフィードに出力する', () => {
    const feedItem = {
      title: 'テスト記事',
      link: 'https://example.com/test-article/',
      isoDate: '2026-06-09T04:03:10.000Z',
      blogTitle: 'Example Tech Blog',
      blogLink: 'https://example.com',
    } as CustomRssParserItem;
    const imageUrl = 'https://example.com/image.png?width=1200&format=webp';
    const favicon = 'data:image/png;base64,iVBORw0KGgo=';
    const ogObjectMap = new Map([
      [
        feedItem.link,
        {
          customOgImage: { url: imageUrl },
          favicon,
        },
      ],
    ]) as OgObjectMap;
    const feedGenerator = new FeedGenerator();

    const result = feedGenerator.generateFeeds([feedItem], ogObjectMap, new Map(), 200, 500, testFeedMeta);

    expect(result.aggregatedFeed.items[0].image).toMatchObject({ url: imageUrl });
    expect(result.feedDistributionSet.json).toContain(imageUrl);
    expect(result.feedDistributionSet.json).toContain(favicon);
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
  it('URLでないguidはlinkをidにしてAtomフィードを生成できる', () => {
    const feedItem = {
      title: 'テスト記事',
      link: 'https://example.com/test-article/',
      guid: '6a853e4d08752169b9ab7316',
      isoDate: '2026-06-09T04:03:10.000Z',
      blogTitle: 'Example Tech Blog',
      blogLink: 'https://example.com',
    } as CustomRssParserItem;
    const feedGenerator = new FeedGenerator();

    const result = feedGenerator.generateFeeds([feedItem], new Map(), new Map(), 200, 500, testFeedMeta);

    expect(result.aggregatedFeed.items[0].id).toEqual(feedItem.guid);
    expect(JSON.parse(result.feedDistributionSet.json).items[0].id).toBe(feedItem.guid);
    expect(result.feedDistributionSet.rss).toContain(feedItem.guid);
    expect(result.feedDistributionSet.atom).toContain('<id>https://example.com/test-article/</id>');
  });

  it('不正なリンクのitemはスキップしてフィード生成できる', () => {
    const invalidItem = {
      title: 'テスト記事',
      link: 'not-a-url',
      guid: '6a853e4d08752169b9ab7316',
      isoDate: '2026-06-09T04:03:10.000Z',
      blogTitle: 'Example Tech Blog',
      blogLink: 'https://example.com',
    } as CustomRssParserItem;
    const validItem = {
      title: 'テスト記事',
      link: 'https://example.com/test-article/',
      guid: 'https://example.com/?p=1',
      isoDate: '2026-06-09T04:03:10.000Z',
      blogTitle: 'Example Tech Blog',
      blogLink: 'https://example.com',
    } as CustomRssParserItem;
    const feedGenerator = new FeedGenerator();

    const result = feedGenerator.generateFeeds([invalidItem, validItem], new Map(), new Map(), 200, 500, testFeedMeta);

    expect(result.aggregatedFeed.items).toHaveLength(1);
    expect(result.aggregatedFeed.items[0].link).toEqual('https://example.com/test-article/');
    expect(result.feedDistributionSet.atom).toContain('<feed');
  });

  it('& や < を含むテキストを二重エスケープせず、XML は妥当で JSON はプレーンテキストになる', async () => {
    const feedItem = {
      title: 'A & <B>',
      summary: 'S & <d>',
      categories: ['c & <e>'],
      creator: 'N & <m>',
      link: 'https://example.com/test-article/?a=1&b=2',
      guid: 'https://example.com/test-article/?a=1&b=2',
      isoDate: '2026-06-09T04:03:10.000Z',
      blogTitle: 'R&D Blog',
      blogLink: 'https://example.com',
    } as CustomRssParserItem;
    const ogObjectMap = new Map([
      [feedItem.link, { customOgImage: { url: 'https://example.com/og.png?w=1&h=2', alt: 'alt & <a>' } }],
    ]) as OgObjectMap;
    const feedGenerator = new FeedGenerator();

    const { atom, rss, json } = feedGenerator.generateFeeds(
      [feedItem],
      ogObjectMap,
      new Map(),
      200,
      500,
      testFeedMeta,
    ).feedDistributionSet;

    // XML として妥当で、rss-parser でもパースできる
    expect(XMLValidator.validate(atom)).toBe(true);
    expect(XMLValidator.validate(rss)).toBe(true);
    await expect(new RssParser().parseString(atom)).resolves.toBeTruthy();
    await expect(new RssParser().parseString(rss)).resolves.toBeTruthy();

    // CDATA 内は HTML として一度だけエスケープされる
    expect(atom).toContain('<![CDATA[A &amp; &lt;B&gt; | R&amp;D Blog]]>');
    expect(rss).toContain('<![CDATA[A &amp; &lt;B&gt; | R&amp;D Blog]]>');
    expect(rss).toContain('alt="alt &amp; &lt;a&gt;"');
    expect(atom).not.toContain('&amp;amp;');
    expect(rss).not.toContain('&amp;amp;');

    // JSON Feed の title / summary / tags / _custom はプレーンテキスト、content_html は HTML
    const jsonItem = JSON.parse(json).items[0];
    expect(jsonItem.title).toBe('A & <B> | R&D Blog');
    expect(jsonItem.summary).toBe('S & <d>');
    expect(jsonItem.content_html).toBe('S &amp; &lt;d&gt;');
    expect(jsonItem.tags).toEqual(['c & <e>']);
    expect(jsonItem.author.name).toBe('N & <m>');
    expect(jsonItem.url).toBe('https://example.com/test-article/?a=1&b=2');
    expect(jsonItem._custom.originalTitle).toBe('A & <B>');
    expect(jsonItem._custom.blogTitle).toBe('R&D Blog');
  });
});

it('翻訳メタ情報・原文・GUIDを保持し、JSON画像をURL文字列で配信する', () => {
  const item = {
    title: '翻訳 & <API>',
    originalTitle: 'Original & <API>',
    summary: '概要 & <例>',
    link: 'https://example.com/article',
    guid: 'stable-source-id',
    isoDate: '2026-09-27T00:00:00Z',
    blogTitle: 'R&D',
    blogLink: 'https://example.com',
    sectionId: 'ai',
    sourceLanguage: 'en',
  } as CustomRssParserItem;
  const images: OgObjectMap = new Map([[item.link, { customOgImage: { url: 'https://example.com/image.png' } }]]);
  const result = new FeedGenerator().generateFeeds([item], images, new Map(), 200, 500, {
    ...testFeedMeta,
    language: 'ja',
    title: 'AI - Translated Japanese',
  });
  const json = JSON.parse(result.feedDistributionSet.json);
  expect(json.title).toBe('AI - Translated Japanese');
  expect(json.feed_url).toBe(testFeedMeta.feedUrls.json);
  expect(json.items[0]).toMatchObject({
    id: 'stable-source-id',
    image: 'https://example.com/image.png',
    title: '翻訳 & <API> | R&D',
    _custom: { originalTitle: 'Original & <API>', translatedTitle: '翻訳 & <API>', blogTitle: 'R&D' },
  });
  expect(result.feedDistributionSet.rss).toContain('<language>ja</language>');
  expect(result.feedDistributionSet.atom).toContain('<id>https://example.com/article</id>');
});
