import * as fs from 'node:fs';
import * as path from 'node:path';
import { FEED_SECTION_LIST } from './feed-info-list';
import { TRANSLATED_FEED_DEFINITION_LIST } from './translated-feed-list';

export interface DeduplicatedFeedDefinition {
  id: string;
  title: string;
  sourceSectionIds: string[];
  priority: number;
}

/** 通常カテゴリだけを入力とし、公開IDの衝突と曖昧な所属を拒否する。 */
export const parseDeduplicatedFeeds = (
  value: unknown,
  sourceIds: readonly string[],
  reservedIds: readonly string[],
): DeduplicatedFeedDefinition[] => {
  if (!Array.isArray(value)) throw new Error('重複除外フィード定義は配列で指定してください');
  const ids = new Set([...sourceIds, ...reservedIds]);
  const sources = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('重複除外フィード定義が不正です');
    const item = entry as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]{0,99}$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      item.title.length > 200 ||
      typeof item.priority !== 'number' ||
      !Number.isSafeInteger(item.priority) ||
      item.priority < 0 ||
      !Array.isArray(item.sourceSectionIds) ||
      item.sourceSectionIds.length === 0 ||
      !item.sourceSectionIds.every((id): id is string => typeof id === 'string' && sourceIds.includes(id)) ||
      new Set(item.sourceSectionIds).size !== item.sourceSectionIds.length ||
      item.sourceSectionIds.some((id) => sources.has(id))
    )
      throw new Error('重複除外フィードのID・表示名・優先度・入力カテゴリが不正です');
    ids.add(item.id);
    for (const id of item.sourceSectionIds) sources.add(id);
    return { id: item.id, title: item.title, priority: item.priority, sourceSectionIds: item.sourceSectionIds };
  });
};

const directory = new URL('./deduplicated-feeds/', import.meta.url);
const definitions = fs
  .readdirSync(directory)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => {
    const value: unknown = JSON.parse(fs.readFileSync(new URL(file, directory), 'utf-8'));
    if (!value || typeof value !== 'object' || Array.isArray(value) || 'id' in value)
      throw new Error('重複除外フィードのIDはファイル名で指定してください');
    return { ...value, id: path.basename(file, '.json') };
  });

export const DEDUPLICATED_FEED_DEFINITION_LIST = parseDeduplicatedFeeds(
  definitions,
  FEED_SECTION_LIST.map((section) => section.id),
  TRANSLATED_FEED_DEFINITION_LIST.map((section) => section.id),
).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
