import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import constants, { sectionFeedUrls, sectionPageUrl } from '../../common/constants';
import type { TranslatedFeedDefinition } from '../../resources/translated-feed-list';
import type { CustomRssParserItem, FeedItemHatenaCountMap, OgObjectMap } from '../feed-crawler';
import { type FeedDistributionSet, FeedGenerator } from '../feed-generator';
import { logger } from '../logger';
import { formatGoogleCloudReleaseNotes } from './google-cloud-release-notes';
import { TranslationCache } from './translation-cache';
import { type TranslationBudget, TranslationService } from './translation-service';
import { createTranslator } from './translator-factory';

type TranslationServiceFactory = (
  sourceLanguage: 'en' | 'zh',
  budget: TranslationBudget,
) => Pick<TranslationService, 'translateItems'>;

/** 翻訳キャッシュと選択済みプロバイダーを結び付ける */
const createTranslationService: TranslationServiceFactory = (sourceLanguage, budget) => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  return new TranslationService(
    createTranslator(sourceLanguage),
    new TranslationCache(path.join(root, '.cache/translations')),
    budget,
  );
};

/** 同じ取得結果から設定された言語の記事を日本語のセクション別フィードへ派生させる */
export const generateTranslatedFeeds = async (
  items: readonly CustomRssParserItem[],
  definitions: readonly TranslatedFeedDefinition[],
  ogObjects: OgObjectMap,
  hatenaCounts: FeedItemHatenaCountMap,
  createService: TranslationServiceFactory = createTranslationService,
): Promise<Map<string, FeedDistributionSet>> => {
  const translatedItems: CustomRssParserItem[] = [];
  const budget: TranslationBudget = { startedAt: Date.now() };
  const languages = [...new Set(definitions.map((definition) => definition.sourceLanguage))];
  const groups = languages
    .map((language) => {
      const sourceIds = new Set(
        definitions
          .filter((definition) => definition.sourceLanguage === language)
          .map((definition) => definition.sourceSectionId),
      );
      const sourceItems = items.filter((item) => sourceIds.has(item.sectionId) && item.sourceLanguage === language);
      return { language, sourceItems };
    })
    .sort((a, b) => a.sourceItems.length - b.sourceItems.length || a.language.localeCompare(b.language));
  // 少量の言語も予算内で処理できるよう、対象件数順に共有の期限を使う。
  for (const { language, sourceItems } of groups) {
    if (!sourceItems.length) continue;
    let output = sourceItems;
    try {
      output = await createService(language, budget).translateItems(sourceItems, language, 'ja');
    } catch {
      logger.warn('[translate] unavailable; using-originals', { language, count: sourceItems.length });
    }
    translatedItems.push(...output.map((item) => ({ ...item, originalTitle: item.originalTitle ?? item.title ?? '' })));
  }
  const generator = new FeedGenerator();
  const feeds = new Map<string, FeedDistributionSet>();
  for (const definition of definitions) {
    const sectionItems = translatedItems
      .filter((item) => item.sectionId === definition.sourceSectionId)
      .map((item) =>
        definition.sourceSectionId === 'googlecloud' && definition.targetLanguage === 'ja'
          ? formatGoogleCloudReleaseNotes(item)
          : item,
      )
      .sort((left, right) => right.isoDate.localeCompare(left.isoDate) || left.link.localeCompare(right.link));
    const result = generator.generateFeeds(
      sectionItems,
      ogObjects,
      hatenaCounts,
      constants.maxFeedDescriptionLength,
      constants.maxFeedContentLength,
      {
        title: `${definition.title}｜${constants.feedTitle}`,
        description: `${definition.title}：${definition.sourceLanguage}の記事を日本語に翻訳してまとめたRSSフィード`,
        language: definition.targetLanguage,
        pageUrl: sectionPageUrl(definition.id),
        feedUrls: sectionFeedUrls(definition.id),
      },
    );
    feeds.set(definition.id, result.feedDistributionSet);
  }
  return feeds;
};
