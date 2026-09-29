import { createHash } from 'node:crypto';
import { sectionFeedUrls } from '../../common/constants';
import { isPublishableHttpUrl } from '../../common/url-guard';
import type { DeduplicatedFeedDefinition } from '../../resources/deduplicated-feed-list';
import { normalizeArticleUrl } from '../common-util';
import type { CustomRssParserItem } from '../feed-crawler';
import { slackFeedConfig, slackSourcePath } from '../slack/config';
import { slackArticleKey } from '../slack/model';
import type { SlackFeedState } from '../slack/types';

/** 既に配信した記事の所属を保持し、保持期限内の二重所属は拒否する。 */
const previousOwners = (
  definitions: readonly DeduplicatedFeedDefinition[],
  state: SlackFeedState | null,
  now: Date,
): Map<string, string> => {
  const owners = new Map<string, string>();
  const cutoff = now.getTime() - slackFeedConfig.seenRetentionDays * 86_400_000;
  const histories = definitions.filter(
    (definition) => state?.feeds[slackSourcePath(sectionFeedUrls(definition.id).rss)],
  );
  if (histories.length !== 0 && histories.length !== definitions.length)
    throw new Error('重複除外フィードの配信履歴が一部欠落しています');
  for (const definition of definitions) {
    const history = state?.feeds[slackSourcePath(sectionFeedUrls(definition.id).rss)];
    for (const [key, seen] of Object.entries(history?.seen ?? {})) {
      if (Date.parse(seen.lastSeenAt) < cutoff) continue;
      if (owners.has(key)) throw new Error('重複除外フィードの配信履歴に二重所属があります');
      owners.set(key, definition.id);
    }
  }
  return owners;
};

/** 同順位では特定カテゴリを常に優遇せず、記事とカテゴリの組から順序を固定する。 */
const tieRank = (key: string, id: string): string => createHash('sha256').update(`${key}:${id}`).digest('hex');

interface Candidate {
  definition: DeduplicatedFeedDefinition;
  item: CustomRssParserItem;
}

/** 同じ配信先では直接取得するブログを優先し、入力配列の順序に依存させない。 */
const compareCandidates = (a: Candidate, b: Candidate, key: string): number =>
  a.definition.priority - b.definition.priority ||
  tieRank(key, a.definition.id).localeCompare(tieRank(key, b.definition.id)) ||
  a.definition.sourceSectionIds.indexOf(a.item.sectionId) - b.definition.sourceSectionIds.indexOf(b.item.sectionId) ||
  (a.item.sourceFeedUrl ?? '').localeCompare(b.item.sourceFeedUrl ?? '') ||
  a.item.isoDate.localeCompare(b.item.isoDate) ||
  (a.item.title ?? '').localeCompare(b.item.title ?? '');

/** 同一実行の新規記事だけに優先度を適用し、既知の記事を別RSSへ移動しない。 */
export const selectDeduplicatedItems = (
  items: readonly CustomRssParserItem[],
  definitions: readonly DeduplicatedFeedDefinition[],
  state: SlackFeedState | null,
  now: Date,
): Map<string, CustomRssParserItem[]> => {
  const owners = previousOwners(definitions, state, now);
  const inputs = new Map(
    definitions.flatMap((definition) => definition.sourceSectionIds.map((id) => [id, definition] as const)),
  );
  const groups = new Map<string, Candidate[]>();
  for (const source of items) {
    const definition = inputs.get(source.sectionId);
    if (!definition) continue;
    const link = normalizeArticleUrl(source.link);
    if (
      !isPublishableHttpUrl(link) ||
      !Number.isFinite(Date.parse(source.isoDate)) ||
      Date.parse(source.isoDate) > now.getTime()
    )
      throw new Error('重複除外対象の記事URL・公開日時が不正です');
    const key = slackArticleKey(link);
    const group = groups.get(key) ?? [];
    group.push({ definition, item: { ...source, link } });
    groups.set(key, group);
  }
  const selected = new Map(definitions.map((definition) => [definition.id, [] as CustomRssParserItem[]]));
  for (const [key, group] of groups) {
    group.sort((a, b) => compareCandidates(a, b, key));
    const owner = owners.get(key) ?? group[0].definition.id;
    const candidate = group.find((entry) => entry.definition.id === owner) ?? group[0];
    selected.get(owner)?.push(candidate.item);
  }
  for (const articles of selected.values()) {
    articles.sort((a, b) => b.isoDate.localeCompare(a.isoDate) || a.link.localeCompare(b.link));
  }
  return selected;
};
