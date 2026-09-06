import RssParser from 'rss-parser';
// フィード取得テスト
import { describe, expect, it } from 'vitest';
import { exponentialBackoff } from '../../src/feed/common-util';
import { FEED_INFO_LIST, type FeedInfo } from '../../src/resources/feed-info-list';

const rssParser = new RssParser({
  maxRedirects: 0,
});

describe('フィードが取得可能', () => {
  FEED_INFO_LIST.filter((feedInfo: FeedInfo) => feedInfo.input.kind === 'remote').map((feedInfo: FeedInfo) => {
    const testTitle = `${feedInfo.label} / ${feedInfo.url}`;
    it.concurrent(
      testTitle,
      async () => {
        const feed = await exponentialBackoff(
          async () => {
            if (feedInfo.input.kind !== 'remote') {
              throw new Error('外部フィードではありません');
            }
            return rssParser.parseURL(feedInfo.input.url);
          },
          3000,
          5,
        );
        expect(feed.items.length).toBeGreaterThanOrEqual(0);
      },
      180 * 1000,
    );
  });
});
