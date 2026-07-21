import * as path from 'node:path';
import * as url from 'node:url';
import constants, { sectionFeedUrls, sectionPageUrl } from '../common/constants';
import { FeedCrawler } from '../feed/feed-crawler';
import { type AggregatedFeedMeta, type FeedDistributionSet, FeedGenerator } from '../feed/feed-generator';
import { FeedStorer } from '../feed/feed-storer';
import { FeedValidator } from '../feed/feed-validator';
import { logger } from '../feed/logger';
import { FEED_INFO_LIST, FEED_SECTION_LIST, type FeedSection } from '../resources/feed-info-list';

const dirName = url.fileURLToPath(new URL('.', import.meta.url));

const STORE_FEEDS_DIR_PATH = path.join(dirName, '../site/feeds');
const STORE_BLOG_FEEDS_DIR_PATH = path.join(dirName, '../site/blog-feeds');
const STORE_SECTION_FEEDS_DIR_PATH = path.join(dirName, '../site/section-feeds');

const feedCrawler = new FeedCrawler();
const feedGenerator = new FeedGenerator();
const feedValidator = new FeedValidator();
const feedStorer = new FeedStorer();

/**
 * 全体まとめフィードのメタ情報
 */
const createAggregatedFeedMeta = (): AggregatedFeedMeta => ({
  title: constants.feedTitle,
  description: constants.feedDescription,
  pageUrl: `${constants.siteUrlStem}/`,
  feedUrls: constants.feedUrls,
});

/**
 * セクションまとめフィードのメタ情報
 */
const createSectionFeedMeta = (section: FeedSection): AggregatedFeedMeta => ({
  title: `${section.title}｜${constants.feedTitle}`,
  description: `${section.title}セクションのブログ更新をまとめたRSSフィード`,
  pageUrl: sectionPageUrl(section.id),
  feedUrls: sectionFeedUrls(section.id),
});

(async () => {
  // フィード取得
  const crawlFeedsResult = await feedCrawler.crawlFeeds(
    FEED_INFO_LIST,
    constants.feedFetchConcurrency,
    constants.feedOgFetchConcurrency,
    new Date(Date.now() - constants.aggregateFeedDurationInHours * 60 * 60 * 1000),
  );

  // まとめフィード作成 + ファイル出力 + バリデーション
  const generateStoreValidateStartTime = Date.now();

  // 全体まとめフィード作成
  const ogObjectMap = new Map([...crawlFeedsResult.feedItemOgObjectMap, ...crawlFeedsResult.feedBlogOgObjectMap]);
  const generateFeedsResult = feedGenerator.generateFeeds(
    crawlFeedsResult.feedItems,
    ogObjectMap,
    crawlFeedsResult.feedItemHatenaCountMap,
    constants.maxFeedDescriptionLength,
    constants.maxFeedContentLength,
    createAggregatedFeedMeta(),
  );

  // セクションごとのまとめフィード作成
  const sectionFeedDistributionSets = new Map<string, FeedDistributionSet>();
  for (const section of FEED_SECTION_LIST) {
    const sectionFeedItems = crawlFeedsResult.feedItems.filter((feedItem) => feedItem.sectionId === section.id);
    const sectionGenerateFeedsResult = feedGenerator.generateFeeds(
      sectionFeedItems,
      ogObjectMap,
      crawlFeedsResult.feedItemHatenaCountMap,
      constants.maxFeedDescriptionLength,
      constants.maxFeedContentLength,
      createSectionFeedMeta(section),
    );
    sectionFeedDistributionSets.set(section.id, sectionGenerateFeedsResult.feedDistributionSet);
  }

  // ファイル出力
  try {
    await feedStorer.storeFeeds(
      generateFeedsResult.feedDistributionSet,
      STORE_FEEDS_DIR_PATH,
      crawlFeedsResult.feeds,
      ogObjectMap,
      crawlFeedsResult.feedItemHatenaCountMap,
      STORE_BLOG_FEEDS_DIR_PATH,
    );
    await feedStorer.storeSectionFeeds(sectionFeedDistributionSets, STORE_SECTION_FEEDS_DIR_PATH);
  } catch (e) {
    const error = new Error('Failed to store feeds', {
      cause: e,
    });
    console.error(error);
    throw error;
  }

  // 最後にまとめフィードのバリデーション
  try {
    logger.info('フィードのバリデーション開始');

    await feedValidator.assertFeed(generateFeedsResult.aggregatedFeed);
    await feedValidator.assertXmlFeed('atom', generateFeedsResult.feedDistributionSet.atom);
    await feedValidator.assertXmlFeed('rss', generateFeedsResult.feedDistributionSet.rss);

    // セクションフィードは記事が無い期間もあり得るため、XMLとして妥当かのみ検証する
    for (const [sectionId, feedDistributionSet] of sectionFeedDistributionSets) {
      await feedValidator.assertXmlFeed(`${sectionId}-atom`, feedDistributionSet.atom);
      await feedValidator.assertXmlFeed(`${sectionId}-rss`, feedDistributionSet.rss);
    }

    logger.info('フィードのバリデーション完了');
  } catch (e) {
    const error = new Error('Failed to validate feed', {
      cause: e,
    });
    console.error(error);
    throw error;
  }

  logger.info(
    '[phase] generate + store + validate feeds',
    `${((Date.now() - generateStoreValidateStartTime) / 1000).toFixed(1)}s`,
  );
})();
