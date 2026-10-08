import RssParser from 'rss-parser';
// フィード取得テスト
import { describe, expect, it } from 'vitest';
import { exponentialBackoff } from '../../src/feed/common-util';
import { parseRemoteFeed } from '../../src/feed/remote-feed-input';
import { SourceRequestQueue, isRetryableSourceError } from '../../src/feed/source-request';
import { FEED_INFO_LIST, type FeedInfo } from '../../src/resources/feed-info-list';
import { providerCheck } from './provider-check';

const rssParser = new RssParser();
const queue = new SourceRequestQueue();

describe('フィードが取得可能', () => {
  FEED_INFO_LIST.filter((feedInfo: FeedInfo) => feedInfo.input.kind === 'remote').map((feedInfo: FeedInfo) => {
    const testTitle = `${feedInfo.label} / ${feedInfo.url}`;
    it.concurrent(
      testTitle,
      async (context) => {
        const deadline = Date.now() + 50_000;
        const xml = await providerCheck(feedInfo.url, context, () =>
          exponentialBackoff(
            async () => {
              if (feedInfo.input.kind !== 'remote') {
                throw new Error('外部フィードではありません');
              }
              return queue.fetchText(feedInfo.input.url, { deadline });
            },
            500,
            2,
            isRetryableSourceError,
          ),
        );
        const { feed } = await parseRemoteFeed(xml, rssParser, feedInfo.label);
        expect(feed.items.length).toBeGreaterThanOrEqual(0);
      },
      60 * 1000,
    );
  });
});
