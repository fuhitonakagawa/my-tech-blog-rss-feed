import * as path from 'node:path';
import * as url from 'node:url';
import constants, { sectionFeedUrls, sectionPageUrl } from '../common/constants';
import { deduplicatedStatisticsSections, generateDeduplicatedFeeds } from '../feed/deduplication/service';
import { FeedCrawler } from '../feed/feed-crawler';
import { type AggregatedFeedMeta, type FeedDistributionSet, FeedGenerator } from '../feed/feed-generator';
import { FeedStorer } from '../feed/feed-storer';
import { FeedValidator } from '../feed/feed-validator';
import { GeneratedFeedService } from '../feed/generated/generated-feed-service';
import { logger } from '../feed/logger';
import { generateSlackFeeds } from '../feed/slack/service';
import { loadSlackSources } from '../feed/slack/sources';
import { statisticsConfig } from '../feed/statistics/config';
import { generateStatistics } from '../feed/statistics/service';
import { collectTranslatedStatisticsItems } from '../feed/statistics/translated-items';
import { generateTranslatedFeeds } from '../feed/translation/translated-feed-generator';
import { DEDUPLICATED_FEED_DEFINITION_LIST } from '../resources/deduplicated-feed-list';
import { FEED_INFO_LIST, FEED_SECTION_LIST, type FeedSection } from '../resources/feed-info-list';
import { GENERATED_FEED_DEFINITION_LIST } from '../resources/generated-feed-list';
import { TRANSLATED_FEED_DEFINITION_LIST } from '../resources/translated-feed-list';

const dirName = url.fileURLToPath(new URL('.', import.meta.url));

const STORE_FEEDS_DIR_PATH = path.join(dirName, '../site/feeds');
const STORE_BLOG_FEEDS_DIR_PATH = path.join(dirName, '../site/blog-feeds');
const STORE_SECTION_FEEDS_DIR_PATH = path.join(dirName, '../site/section-feeds');
const STORE_DEDUPLICATED_FEEDS_DIR_PATH = path.join(dirName, '../site/deduplicated-feeds');
const STORE_TRANSLATED_FEEDS_DIR_PATH = path.join(dirName, '../site/translated-feeds');
const STORE_GENERATED_FEEDS_DIR_PATH = path.join(dirName, '../site/feeds/generated');
const PREVIOUS_GENERATED_FEEDS_DIR_PATH = path.join(dirName, '../../.previous-site/feeds/generated');

const feedGenerator = new FeedGenerator();
const feedValidator = new FeedValidator();
const feedStorer = new FeedStorer();
const generatedFeedService = new GeneratedFeedService();

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
  const generatedFeedRegistry = await generatedFeedService.generate(
    GENERATED_FEED_DEFINITION_LIST,
    PREVIOUS_GENERATED_FEEDS_DIR_PATH,
    STORE_GENERATED_FEEDS_DIR_PATH,
  );

  // フィード取得
  const feedCrawler = new FeedCrawler(generatedFeedRegistry);
  const availableFeedInfoList = FEED_INFO_LIST.filter((feedInfo) => {
    return feedInfo.input.kind === 'remote' || generatedFeedRegistry.has(feedInfo.input.id);
  });
  const crawlFeedsResult = await feedCrawler.crawlFeeds(
    availableFeedInfoList,
    constants.feedFetchConcurrency,
    constants.feedOgFetchConcurrency,
    new Date(Date.now() - constants.aggregateFeedDurationInHours * 60 * 60 * 1000),
  );
  const collectedAt = new Date();

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

  const translatedFeeds = await generateTranslatedFeeds(
    crawlFeedsResult.feedItems,
    TRANSLATED_FEED_DEFINITION_LIST,
    ogObjectMap,
    crawlFeedsResult.feedItemHatenaCountMap,
  );

  const deduplicated = await generateDeduplicatedFeeds(
    crawlFeedsResult.feedItems,
    DEDUPLICATED_FEED_DEFINITION_LIST,
    ogObjectMap,
    crawlFeedsResult.feedItemHatenaCountMap,
    path.join(dirName, '../../.previous-site'),
    path.join(dirName, '../site'),
    collectedAt,
  );

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
    await feedStorer.storeSectionFeeds(translatedFeeds, STORE_TRANSLATED_FEEDS_DIR_PATH);
    await feedStorer.storeSectionFeeds(deduplicated.feeds, STORE_DEDUPLICATED_FEEDS_DIR_PATH);
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

    await feedValidator.assertXmlFeed('atom', generateFeedsResult.feedDistributionSet.atom);
    await feedValidator.assertXmlFeed('rss', generateFeedsResult.feedDistributionSet.rss);

    // セクションフィードは記事が無い期間もあり得るため、XMLとして妥当かのみ検証する
    for (const [sectionId, feedDistributionSet] of [
      ...sectionFeedDistributionSets,
      ...translatedFeeds,
      ...deduplicated.feeds,
    ]) {
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

  await generateStatistics(
    [...crawlFeedsResult.feeds.flatMap((feed) => feed.items), ...deduplicated.statisticsItems],
    [...FEED_SECTION_LIST, ...deduplicatedStatisticsSections(DEDUPLICATED_FEED_DEFINITION_LIST)],
    path.join(dirName, '../../.previous-site', statisticsConfig.feedPath),
    path.join(dirName, '../site', statisticsConfig.feedPath),
    collectedAt,
    TRANSLATED_FEED_DEFINITION_LIST,
    collectTranslatedStatisticsItems(crawlFeedsResult.feedItems, TRANSLATED_FEED_DEFINITION_LIST, translatedFeeds),
    deduplicated.usePublishedHistory ? DEDUPLICATED_FEED_DEFINITION_LIST.map((definition) => definition.id) : [],
  );

  await generateSlackFeeds(
    await loadSlackSources(path.join(dirName, '../site'), [...generatedFeedRegistry.keys()]),
    path.join(dirName, '../../.previous-site'),
    path.join(dirName, '../site'),
  );

  logger.info(
    '[phase] generate + store + validate feeds',
    `${((Date.now() - generateStoreValidateStartTime) / 1000).toFixed(1)}s`,
  );
})();
