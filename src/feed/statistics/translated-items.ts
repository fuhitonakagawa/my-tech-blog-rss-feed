import type { TranslatedFeedDefinition } from '../../resources/translated-feed-list';
import { normalizeArticleUrl } from '../common-util';
import type { CustomRssParserItem } from '../feed-crawler';
import type { FeedDistributionSet } from '../feed-generator';

/** 同一実行で生成した翻訳フィードに実在する記事を、取得元情報と照合する。 */
export const collectTranslatedStatisticsItems = (
  items: readonly CustomRssParserItem[],
  definitions: readonly TranslatedFeedDefinition[],
  feeds: ReadonlyMap<string, FeedDistributionSet>,
): CustomRssParserItem[] => {
  const selected: CustomRssParserItem[] = [];
  for (const definition of definitions) {
    const feed = feeds.get(definition.id);
    if (!feed) continue;
    const parsed: { items: { url: string }[] } = JSON.parse(feed.json);
    const urls = new Set(parsed.items.map((item) => normalizeArticleUrl(item.url)));
    selected.push(
      ...items.filter(
        (item) =>
          item.sectionId === definition.sourceSectionId &&
          item.sourceLanguage === 'en' &&
          urls.has(normalizeArticleUrl(item.link)),
      ),
    );
  }
  return selected;
};
