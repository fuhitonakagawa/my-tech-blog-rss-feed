import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import constants from '../../common/constants';
import { slackFeedConfig, slackSourcePath } from './config';
import { parseSlackState, serializeSlackState } from './state-store';
import type { SlackFeedState } from './types';

const decompress = promisify(gunzip);
const maxTotalBytes = 1024 * 1024 * 1024;
const filename = (key: string): string => `state-${createHash('sha256').update(key).digest('hex')}.json.gz`;
interface ShardRecord {
  file: string;
  bytes: number;
  decodedBytes: number;
  sha256: string;
}
interface ShardManifest {
  schemaVersion: 2;
  updatedAt: string;
  feeds: Record<string, ShardRecord>;
  metrics: { compressedBytes: number; decodedBytes: number; maxFeedBytes: number; totalDecodedLimitBytes: number };
}

/** 通知履歴をフィード単位で検証・圧縮し、全体の容量増加を記録する。 */
export const serializeSlackShards = async (state: SlackFeedState): Promise<Map<string, string | Buffer>> => {
  parseSlackState(JSON.stringify({ ...state, feeds: {} }));
  const files = new Map<string, string | Buffer>();
  const manifest: ShardManifest = {
    schemaVersion: 2,
    updatedAt: state.updatedAt,
    feeds: {},
    metrics: { compressedBytes: 0, decodedBytes: 0, maxFeedBytes: 0, totalDecodedLimitBytes: maxTotalBytes },
  };
  for (const [key, history] of Object.entries(state.feeds)) {
    const shard: SlackFeedState = { schemaVersion: 1, updatedAt: state.updatedAt, feeds: { [key]: history } };
    const decodedBytes = Buffer.byteLength(`${JSON.stringify(shard)}\n`);
    if (manifest.metrics.decodedBytes + decodedBytes > maxTotalBytes)
      throw new Error('通知履歴の合計展開サイズが上限を超えています');
    const content = await serializeSlackState(shard);
    const file = filename(key);
    files.set(file, content);
    manifest.feeds[key] = {
      file,
      bytes: content.byteLength,
      decodedBytes,
      sha256: createHash('sha256').update(content).digest('hex'),
    };
    manifest.metrics.compressedBytes += content.byteLength;
    manifest.metrics.decodedBytes += decodedBytes;
    manifest.metrics.maxFeedBytes = Math.max(manifest.metrics.maxFeedBytes, content.byteLength);
  }
  if (manifest.metrics.decodedBytes > maxTotalBytes) throw new Error('通知履歴の合計展開サイズが上限を超えています');
  const index = `${JSON.stringify(manifest)}\n`;
  if (Buffer.byteLength(index) > 1024 * 1024 || Object.keys(manifest.feeds).length > 1024)
    throw new Error('通知履歴のフィード数が上限を超えています');
  files.set('index.json', index);
  if (
    Object.values(manifest.feeds).some((record) => record.decodedBytes > slackFeedConfig.maxDecodedStateBytes * 0.75) ||
    manifest.metrics.maxFeedBytes > slackFeedConfig.maxStateBytes * 0.75 ||
    manifest.metrics.decodedBytes > maxTotalBytes * 0.75
  )
    console.warn(
      '::warning::通知履歴が容量上限の75%を超えています。feeds/delivery/index.json のmetricsを確認してください。',
    );
  return files;
};

/** マニフェスト・ハッシュ・サイズ・各履歴を検証し、破損時に旧形式へ戻さない。 */
export const readSlackShards = async (directory: string): Promise<SlackFeedState> => {
  const indexFile = path.join(directory, 'index.json');
  const info = await fs.lstat(indexFile);
  if (!info.isFile() || info.size > 1024 * 1024) throw new Error('通知履歴のマニフェストが不正です');
  const manifest = JSON.parse(await fs.readFile(indexFile, 'utf8')) as ShardManifest;
  if (
    !manifest ||
    manifest.schemaVersion !== 2 ||
    typeof manifest.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(manifest.updatedAt)) ||
    new Date(manifest.updatedAt).toISOString() !== manifest.updatedAt ||
    !manifest.feeds ||
    Array.isArray(manifest.feeds) ||
    typeof manifest.feeds !== 'object' ||
    Object.keys(manifest.feeds).length > 1024
  )
    throw new Error('通知履歴のマニフェストが不正です');
  const state: SlackFeedState = { schemaVersion: 1, updatedAt: manifest.updatedAt, feeds: {} };
  let totalBytes = 0;
  for (const [key, record] of Object.entries(manifest.feeds)) {
    slackSourcePath(`${constants.siteUrl}${key}`);
    if (
      !record ||
      record.file !== filename(key) ||
      !Number.isSafeInteger(record.bytes) ||
      record.bytes <= 0 ||
      record.bytes > slackFeedConfig.maxStateBytes ||
      !Number.isSafeInteger(record.decodedBytes) ||
      record.decodedBytes <= 0 ||
      record.decodedBytes > slackFeedConfig.maxDecodedStateBytes ||
      !/^[a-f0-9]{64}$/.test(record.sha256)
    )
      throw new Error('通知履歴の分割ファイル情報が不正です');
    totalBytes += record.decodedBytes;
    if (totalBytes > maxTotalBytes) throw new Error('通知履歴の合計展開サイズが上限を超えています');
    const file = path.join(directory, record.file);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size !== record.bytes) throw new Error('通知履歴の分割ファイルが不正です');
    const content = await fs.readFile(file);
    if (content.byteLength !== record.bytes || createHash('sha256').update(content).digest('hex') !== record.sha256)
      throw new Error('通知履歴の分割ファイルのハッシュが不正です');
    const decoded = await decompress(content, { maxOutputLength: slackFeedConfig.maxDecodedStateBytes });
    if (decoded.byteLength !== record.decodedBytes) throw new Error('通知履歴の展開サイズが不正です');
    const shard = parseSlackState(decoded.toString('utf8'));
    if (shard.updatedAt !== manifest.updatedAt || Object.keys(shard.feeds).length !== 1 || !shard.feeds[key])
      throw new Error('通知履歴の分割内容が不正です');
    state.feeds[key] = shard.feeds[key];
  }
  return state;
};

/** 完全な世代を一時ディレクトリへ書き、旧世代を残せる順序で置換する。 */
export const writeSlackShards = async (
  directory: string,
  files: ReadonlyMap<string, string | Buffer>,
): Promise<void> => {
  await fs.mkdir(path.dirname(directory), { recursive: true });
  const temporary = `${directory}.${randomUUID()}.tmp`;
  const backup = `${directory}.${randomUUID()}.old`;
  await fs.mkdir(temporary);
  let saved = false;
  try {
    for (const [file, data] of files) {
      if (file !== 'index.json' && !/^state-[a-f0-9]{64}\.json\.gz$/.test(file))
        throw new Error('通知履歴の保存先が不正です');
      await fs.writeFile(path.join(temporary, file), data);
    }
    try {
      await fs.rename(directory, backup);
      saved = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    try {
      await fs.rename(temporary, directory);
    } catch (error) {
      if (saved) await fs.rename(backup, directory);
      throw error;
    }
    if (saved) await fs.rm(backup, { recursive: true });
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
};
