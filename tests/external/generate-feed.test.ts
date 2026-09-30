import { describe, expect, it } from 'vitest';
import constants from '../../src/common/constants';
import { FeedCrawler } from '../../src/feed/feed-crawler';
import { FeedGenerator } from '../../src/feed/feed-generator';
import { FeedValidator } from '../../src/feed/feed-validator';
import { FEED_INFO_LIST } from '../../src/resources/feed-info-list';

const FEED_FETCH_CONCURRENCY = 50;
const FEED_OG_FETCH_CONCURRENCY = 20;
const FILTER_ARTICLE_DATE = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
const MAX_FEED_DESCRIPTION_LENGTH = 200;
const MAX_FEED_CONTENT_LENGTH = 500;

const feedCrawler = new FeedCrawler();
const feedGenerator = new FeedGenerator();

describe('フィード生成', async () => {
  it('取得できた記事の集約RSS・Atomを厳格に解析できる', async () => {
    // 30個ランダムに取得
    const shuffledFeedInfoList = FEED_INFO_LIST.filter((feedInfo) => feedInfo.input.kind === 'remote').sort(
      () => 0.5 - Math.random(),
    );
    const feedInfoList = shuffledFeedInfoList.slice(0, 30);

    // フィード取得
    const crawlFeedsResult = await feedCrawler.crawlFeeds(
      feedInfoList,
      FEED_FETCH_CONCURRENCY,
      FEED_OG_FETCH_CONCURRENCY,
      FILTER_ARTICLE_DATE,
    );

    // まとめフィード作成
    const ogObjectMap = new Map([...crawlFeedsResult.feedItemOgObjectMap, ...crawlFeedsResult.feedBlogOgObjectMap]);
    const generateFeedsResult = feedGenerator.generateFeeds(
      crawlFeedsResult.feedItems,
      ogObjectMap,
      crawlFeedsResult.feedItemHatenaCountMap,
      MAX_FEED_DESCRIPTION_LENGTH,
      MAX_FEED_CONTENT_LENGTH,
      {
        title: constants.feedTitle,
        description: constants.feedDescription,
        pageUrl: `${constants.siteUrlStem}/`,
        feedUrls: constants.feedUrls,
      },
    );

    const validator = new FeedValidator();
    const { rss, atom, json } = generateFeedsResult.feedDistributionSet;
    const parsedRss = await validator.assertXmlFeed('rss', rss);
    const parsedAtom = await validator.assertXmlFeed('atom', atom);
    const items: { url: string }[] = JSON.parse(json).items;
    expect(crawlFeedsResult.feeds.length).toBeGreaterThan(0);
    expect(parsedRss.items.map((item) => item.link)).toEqual(items.map((item) => item.url));
    expect(parsedAtom.items.map((item) => item.link)).toEqual(items.map((item) => item.url));
  });
});
