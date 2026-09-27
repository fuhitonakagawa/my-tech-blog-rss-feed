import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import constants, { sectionFeedUrls, sectionPageUrl } from '../../common/constants';
import type { TranslatedFeedDefinition } from '../../resources/translated-feed-list';
import type { CustomRssParserItem, FeedItemHatenaCountMap, OgObjectMap } from '../feed-crawler';
import { type FeedDistributionSet, FeedGenerator } from '../feed-generator';
import { logger } from '../logger';
import { TranslationCache } from './translation-cache';
import { TranslationService } from './translation-service';
import { createTranslator } from './translator-factory';

type TranslationServiceFactory = () => Pick<TranslationService, 'translateItems'>;

/** 翻訳キャッシュと選択済みプロバイダーを結び付ける */
const createTranslationService: TranslationServiceFactory = () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  return new TranslationService(createTranslator(), new TranslationCache(path.join(root, '.cache/translations')));
};

/** 同じ取得結果から英語記事だけを日本語のセクション別フィードへ派生させる */
export const generateTranslatedFeeds = async (
  items: readonly CustomRssParserItem[],
  definitions: readonly TranslatedFeedDefinition[],
  ogObjects: OgObjectMap,
  hatenaCounts: FeedItemHatenaCountMap,
  createService: TranslationServiceFactory = createTranslationService,
): Promise<Map<string, FeedDistributionSet>> => {
  const sourceIds = new Set(definitions.map((definition) => definition.sourceSectionId));
  const sourceItems = items.filter((item) => sourceIds.has(item.sectionId) && item.sourceLanguage === 'en');
  let translatedItems = sourceItems.map((item) => ({ ...item, originalTitle: item.originalTitle ?? item.title ?? '' }));
  if (sourceItems.length > 0) {
    try {
      translatedItems = (await createService().translateItems(sourceItems, 'en', 'ja')).map((item) => ({
        ...item,
        originalTitle: item.originalTitle ?? item.title ?? '',
      }));
    } catch {
      logger.warn('[translate] unavailable; using-originals', { count: sourceItems.length });
    }
  }
  const generator = new FeedGenerator();
  const feeds = new Map<string, FeedDistributionSet>();
  for (const definition of definitions) {
    const sectionItems = translatedItems
      .filter((item) => item.sectionId === definition.sourceSectionId)
      .sort((left, right) => right.isoDate.localeCompare(left.isoDate) || left.link.localeCompare(right.link));
    const result = generator.generateFeeds(
      sectionItems,
      ogObjects,
      hatenaCounts,
      constants.maxFeedDescriptionLength,
      constants.maxFeedContentLength,
      {
        title: `${definition.title}｜${constants.feedTitle}`,
        description: `${definition.title.replace(/-JP$/, '')}カテゴリの英語記事を日本語に翻訳してまとめたRSSフィード`,
        language: definition.targetLanguage,
        pageUrl: sectionPageUrl(definition.id),
        feedUrls: sectionFeedUrls(definition.id),
      },
    );
    feeds.set(definition.id, result.feedDistributionSet);
  }
  return feeds;
};
