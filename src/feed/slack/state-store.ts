import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';
import constants from '../../common/constants';
import { isPublishableHttpUrl, isValidImageDataUrl } from '../../common/url-guard';
import { removeInvalidUnicode } from '../common-util';
import { feedItemLimits } from '../feed-item-policy';
import { slackFeedConfig, slackSourcePath } from './config';
import { isSlackDate, slackArticleKey } from './model';
import type { SeenArticle, SlackArticle, SlackFeedHistory, SlackFeedState } from './types';

const compress = promisify(gzip);
const decompress = promisify(gunzip);

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Slack配信履歴の形式が不正です');
  return value as Record<string, unknown>;
};
const validKey = (value: string): boolean => /^[a-f0-9]{64}$/.test(value);
const validText = (value: unknown, limit: number, multiline = false): value is string =>
  typeof value === 'string' &&
  value.length <= limit &&
  (multiline ? value.split('\n').map(removeInvalidUnicode).join('\n') : removeInvalidUnicode(value)) === value;

/** 保存した記事の公開情報と初回掲載日時を検証する。 */
export const parseSlackArticle = (value: unknown): SlackArticle => {
  const item = record(value);
  if (
    typeof item.key !== 'string' ||
    !validKey(item.key) ||
    !validText(item.guid, feedItemLimits.guidLength) ||
    !item.guid ||
    typeof item.url !== 'string' ||
    !isPublishableHttpUrl(item.url) ||
    item.key !== slackArticleKey(item.url) ||
    !validText(item.title, 2000) ||
    !item.title.trim() ||
    !validText(item.summary, 200_000, true) ||
    !(
      item.image === null ||
      (typeof item.image === 'string' && (isPublishableHttpUrl(item.image) || isValidImageDataUrl(item.image)))
    ) ||
    !(item.creator === null || validText(item.creator, 2000)) ||
    !Array.isArray(item.tags) ||
    !item.tags.every((tag) => validText(tag, feedItemLimits.tagLength)) ||
    !isSlackDate(item.originalPublishedAt) ||
    !isSlackDate(item.firstSeenAt)
  ) {
    throw new Error('Slack配信履歴の記事が不正です');
  }
  return {
    key: item.key,
    guid: item.guid,
    url: item.url,
    title: item.title,
    summary: item.summary,
    image: item.image,
    creator: item.creator,
    tags: item.tags,
    originalPublishedAt: item.originalPublishedAt,
    firstSeenAt: item.firstSeenAt,
  };
};

/** 記事を配信欄から外した後も既知の記事として記録する。 */
const parseSeen = (value: unknown, updatedAt: string): Record<string, SeenArticle> =>
  Object.fromEntries(
    Object.entries(record(value)).map(([key, value]) => {
      const item = record(value);
      if (
        !validKey(key) ||
        !validText(item.guid, feedItemLimits.guidLength) ||
        !item.guid ||
        !isSlackDate(item.firstSeenAt) ||
        !isSlackDate(item.lastSeenAt) ||
        item.firstSeenAt > item.lastSeenAt ||
        item.lastSeenAt > updatedAt
      )
        throw new Error('Slack配信履歴の日時が不正です');
      return [key, { guid: item.guid, firstSeenAt: item.firstSeenAt, lastSeenAt: item.lastSeenAt }];
    }),
  );

const parseHistory = (value: unknown, updatedAt: string): SlackFeedHistory => {
  const feed = record(value);
  if (
    !validText(feed.title, 2000) ||
    !feed.title.trim() ||
    !validText(feed.language, 64) ||
    !feed.language ||
    typeof feed.link !== 'string' ||
    !isPublishableHttpUrl(feed.link) ||
    !isSlackDate(feed.lastIssuedAt) ||
    feed.lastIssuedAt > updatedAt ||
    !Array.isArray(feed.items)
  )
    throw new Error('Slack配信履歴のフィードが不正です');
  const items = feed.items.map(parseSlackArticle);
  const seen = parseSeen(feed.seen, updatedAt);
  const ambiguousGuids = feed.ambiguousGuids === undefined ? {} : record(feed.ambiguousGuids);
  const ambiguous: Record<string, string> = {};
  for (const [key, date] of Object.entries(ambiguousGuids)) {
    if (!validKey(key) || !isSlackDate(date) || date > updatedAt)
      throw new Error('Slack配信履歴のGUID競合記録が不正です');
    ambiguous[key] = date;
  }
  const lastIssuedAt = feed.lastIssuedAt;
  if (
    new Set(items.map((item) => item.key)).size !== items.length ||
    Object.values(seen).some((item) => item.firstSeenAt > lastIssuedAt) ||
    items.some((item) => seen[item.key]?.firstSeenAt !== item.firstSeenAt || seen[item.key]?.guid !== item.guid)
  )
    throw new Error('Slack配信履歴の既知記事が不整合です');
  return {
    title: feed.title,
    language: feed.language,
    link: feed.link,
    lastIssuedAt: feed.lastIssuedAt,
    items,
    seen,
    ...(Object.keys(ambiguous).length ? { ambiguousGuids: ambiguous } : {}),
  };
};

/** 外部入力として公開済み履歴を検証し、未知のフィールドを捨てる。 */
export const parseSlackState = (json: string): SlackFeedState => {
  const value = record(JSON.parse(json));
  if (value.schemaVersion !== 1 || !isSlackDate(value.updatedAt))
    throw new Error('Slack配信履歴のバージョン・日時が不正です');
  const updatedAt = value.updatedAt;
  const feeds = Object.fromEntries(
    Object.entries(record(value.feeds)).map(([key, feed]) => {
      slackSourcePath(`${constants.siteUrl}${key}`);
      return [key, parseHistory(feed, updatedAt)];
    }),
  );
  return { schemaVersion: 1, updatedAt, feeds };
};

/** 記事履歴を削らずに圧縮し、展開後と保存時の両方のサイズ上限を守る。 */
export const serializeSlackState = async (state: SlackFeedState): Promise<Buffer> => {
  const json = `${JSON.stringify(state)}\n`;
  if (Buffer.byteLength(json) > slackFeedConfig.maxDecodedStateBytes)
    throw new Error('Slack配信履歴の展開上限を超えています');
  parseSlackState(json);
  const content = await compress(json);
  if (content.byteLength > slackFeedConfig.maxStateBytes) throw new Error('Slack配信履歴の保存上限を超えています');
  return content;
};

/** ディレクトリ未作成だけを初回扱いとし、履歴欠落を初期化で隠さない。 */
export const readSlackState = async (directory: string): Promise<SlackFeedState | null> => {
  try {
    const info = await fs.lstat(directory);
    if (!info.isDirectory()) throw new Error('Slack配信履歴のディレクトリが不正です');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const manifestInfo = await fs.lstat(path.join(directory, 'index.json')).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (manifestInfo !== null) return (await import('./state-shards')).readSlackShards(directory);
  const compressedFile = path.join(directory, 'state.json.gz');
  const compressedInfo = await fs.lstat(compressedFile).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  const compressed = compressedInfo !== null;
  const file = compressed ? compressedFile : path.join(directory, 'state.json');
  const info = compressedInfo ?? (await fs.lstat(file));
  if (!info.isFile() || info.size > slackFeedConfig.maxStateBytes) throw new Error('Slack配信履歴のファイルが不正です');
  const content = await fs.readFile(file);
  if (content.byteLength > slackFeedConfig.maxStateBytes) throw new Error('Slack配信履歴の保存上限を超えています');
  const decoded = compressed
    ? await decompress(content, { maxOutputLength: slackFeedConfig.maxDecodedStateBytes })
    : content;
  const json = decoded.toString('utf-8');
  return parseSlackState(json);
};
