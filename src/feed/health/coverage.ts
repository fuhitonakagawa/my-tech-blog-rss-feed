import { sectionFeedUrls } from '../../common/constants';
import type { DeduplicatedFeedDefinition } from '../../resources/deduplicated-feed-list';
import type { TranslatedFeedDefinition } from '../../resources/translated-feed-list';
import type { CustomRssParserItem } from '../feed-crawler';
import { feedItemIdentifier, isDeliverableIdentifier } from '../feed-item-policy';
import { slackSourcePath } from '../slack/config';
import { slackArticleKey } from '../slack/model';
import type { SlackFeedState } from '../slack/types';
import type { CoverageCheck } from './types';

/** 通常・翻訳は対応先、横断重複除外は全配信先の和集合で通知RSSの掲載を検査する。 */
export const checkFeedCoverage = (
  items: readonly CustomRssParserItem[],
  state: SlackFeedState,
  translated: readonly TranslatedFeedDefinition[],
  deduplicated: readonly DeduplicatedFeedDefinition[],
): CoverageCheck[] => {
  const eligible = items.filter((item) => isDeliverableIdentifier(feedItemIdentifier(item.link, item.guid)));
  const keys = (ids: readonly string[]): Set<string> =>
    new Set(
      ids.flatMap((id) => (state.feeds[slackSourcePath(sectionFeedUrls(id).rss)]?.items ?? []).map((item) => item.key)),
    );
  const check = (
    kind: CoverageCheck['kind'],
    id: string,
    expectedItems: readonly CustomRssParserItem[],
    actual: Set<string>,
  ): CoverageCheck => {
    const expected = new Set(expectedItems.map((item) => slackArticleKey(item.link)));
    return { kind, id, expected: expected.size, missing: [...expected].filter((key) => !actual.has(key)) };
  };
  const normal = [...new Set(eligible.map((item) => item.sectionId))].map((id) =>
    check(
      'normal',
      id,
      eligible.filter((item) => item.sectionId === id),
      keys([id]),
    ),
  );
  const translations = translated.map((definition) =>
    check(
      'translated',
      definition.id,
      eligible.filter(
        (item) => item.sectionId === definition.sourceSectionId && item.sourceLanguage === definition.sourceLanguage,
      ),
      keys([definition.id]),
    ),
  );
  const inputIds = new Set(deduplicated.flatMap((definition) => definition.sourceSectionIds));
  return [
    ...normal,
    ...translations,
    check(
      'deduplicated',
      'all',
      eligible.filter((item) => inputIds.has(item.sectionId)),
      keys(deduplicated.map((definition) => definition.id)),
    ),
  ];
};
