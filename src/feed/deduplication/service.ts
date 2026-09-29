import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import constants, { sectionFeedUrls, sectionPageUrl } from '../../common/constants';
import type { DeduplicatedFeedDefinition } from '../../resources/deduplicated-feed-list';
import type { FeedInfo } from '../../resources/feed-info-list';
import type { CustomRssParserItem, FeedItemHatenaCountMap, OgObjectMap } from '../feed-crawler';
import { type FeedDistributionSet, FeedGenerator } from '../feed-generator';
import { slackSourcePath } from '../slack/config';
import { loadDeliveryHistory } from '../slack/history';
import type { StatisticsSection } from '../statistics/observations';
import { selectDeduplicatedItems } from './selection';

/** 同一実行で取得した記事と公開済み履歴から、独立した三形式の配信物を得る。 */
export const generateDeduplicatedFeeds = async (
  items: readonly CustomRssParserItem[],
  definitions: readonly DeduplicatedFeedDefinition[],
  ogObjects: OgObjectMap,
  hatenaCounts: FeedItemHatenaCountMap,
  publishedDirectory: string,
  outputDirectory: string,
  now: Date,
): Promise<{
  feeds: Map<string, FeedDistributionSet>;
  statisticsItems: CustomRssParserItem[];
  usePublishedHistory: boolean;
}> => {
  const { previous, usePublished } = await loadDeliveryHistory(publishedDirectory, outputDirectory, now);
  if (usePublished) {
    for (const definition of definitions) {
      const file = slackSourcePath(sectionFeedUrls(definition.id).rss);
      if (previous?.feeds[file]) continue;
      try {
        await fs.access(path.join(publishedDirectory, file));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      throw new Error('公開済み重複除外RSSの配信履歴がありません');
    }
  }
  const selected = selectDeduplicatedItems(items, definitions, previous, now);
  const generator = new FeedGenerator();
  const feeds = new Map<string, FeedDistributionSet>();
  const statisticsItems: CustomRssParserItem[] = [];
  for (const definition of definitions) {
    const articles = selected.get(definition.id) ?? [];
    const output = generator.generateFeeds(
      articles,
      ogObjects,
      hatenaCounts,
      constants.maxFeedDescriptionLength,
      constants.maxFeedContentLength,
      {
        title: `${definition.title}｜${constants.feedTitle}`,
        description: '複数カテゴリの記事を統合し、初回配信先を保持する重複除外フィード',
        pageUrl: sectionPageUrl(definition.id),
        feedUrls: sectionFeedUrls(definition.id),
      },
    ).feedDistributionSet;
    feeds.set(definition.id, output);
    const json: { items: { url: string }[] } = JSON.parse(output.json);
    const published = new Set(json.items.map((item) => item.url));
    statisticsItems.push(
      ...articles
        .filter((item) => published.has(item.link))
        .map((item) => ({
          ...item,
          sectionId: definition.id,
          sourceFeedUrl: sectionFeedUrls(definition.id).rss,
        })),
    );
  }
  return { feeds, statisticsItems, usePublishedHistory: usePublished };
};

/** 統計では派生出力を独立したカテゴリとして扱い、原文合計へ加算しない。 */
export const deduplicatedStatisticsSections = (
  definitions: readonly DeduplicatedFeedDefinition[],
): StatisticsSection[] =>
  definitions.map((definition) => ({
    id: definition.id,
    title: definition.title,
    kind: 'deduplicated',
    feedInfoList: [
      {
        label: definition.title,
        url: sectionFeedUrls(definition.id).rss as FeedInfo['url'],
        input: { kind: 'generated', id: definition.id },
      },
    ],
  }));
