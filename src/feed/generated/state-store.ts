import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isPublishableHttpUrl } from '../../common/url-guard';
import type { FeedDistributionSet } from '../feed-generator';
import type { GeneratedFeedItem, GeneratedFeedSnapshot, GeneratedFeedStatus, StoredGeneratedFeedState } from './types';

const GENERATED_FEED_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** 状態ファイルのパスに使用できる生成フィードIDか検証する */
const assertGeneratedFeedId = (generatedFeedId: string): void => {
  if (!GENERATED_FEED_ID_PATTERN.test(generatedFeedId)) {
    throw new Error(`生成フィードID「${generatedFeedId}」が不正です`);
  }
};

/** ファイルが存在しない場合はnullを返す */
const readOptionalFile = async (filePath: string): Promise<string | null> => {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

/** ISO 8601として解釈できる文字列か判定する */
const isIsoDate = (value: unknown): value is string => {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
};

/** 保存済みの記事形式を検証する */
const isGeneratedFeedItem = (value: unknown): value is GeneratedFeedItem => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.url === 'string' &&
    item.id === item.url &&
    isPublishableHttpUrl(item.url) &&
    typeof item.title === 'string' &&
    item.title !== '' &&
    isIsoDate(item.publishedAt) &&
    typeof item.summary === 'string' &&
    Array.isArray(item.categories) &&
    item.categories.every((category) => typeof category === 'string') &&
    typeof item.creator === 'string'
  );
};

/** 保存済みスナップショットを検証する */
const parseSnapshot = (json: string): GeneratedFeedSnapshot => {
  const value: unknown = JSON.parse(json);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('生成フィードのスナップショットが不正です');
  }

  const snapshot = value as Record<string, unknown>;
  if (
    snapshot.schemaVersion !== 1 ||
    typeof snapshot.id !== 'string' ||
    typeof snapshot.definitionHash !== 'string' ||
    typeof snapshot.label !== 'string' ||
    snapshot.label === '' ||
    typeof snapshot.pageUrl !== 'string' ||
    !isPublishableHttpUrl(snapshot.pageUrl) ||
    typeof snapshot.language !== 'string' ||
    snapshot.language === '' ||
    !isIsoDate(snapshot.contentUpdatedAt) ||
    !Array.isArray(snapshot.items) ||
    !snapshot.items.every(isGeneratedFeedItem)
  ) {
    throw new Error('生成フィードのスナップショットが不正です');
  }

  return snapshot as unknown as GeneratedFeedSnapshot;
};

/** 保存済みステータスを検証する */
const parseStatus = (json: string): GeneratedFeedStatus => {
  const value: unknown = JSON.parse(json);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('生成フィードのステータスが不正です');
  }

  const status = value as Record<string, unknown>;
  if (
    status.schemaVersion !== 1 ||
    typeof status.id !== 'string' ||
    !['ok', 'stale', 'unavailable'].includes(String(status.state)) ||
    !isIsoDate(status.lastCheckedAt) ||
    !(status.lastSuccessfulAt === null || isIsoDate(status.lastSuccessfulAt)) ||
    !(status.contentUpdatedAt === null || isIsoDate(status.contentUpdatedAt))
  ) {
    throw new Error('生成フィードのステータスが不正です');
  }

  return status as unknown as GeneratedFeedStatus;
};

/** 生成フィードの公開ファイルと復元用状態を管理する */
export class GeneratedFeedStateStore {
  public async read(rootDirectoryPath: string, generatedFeedId: string): Promise<StoredGeneratedFeedState | null> {
    assertGeneratedFeedId(generatedFeedId);
    const directoryPath = path.join(rootDirectoryPath, generatedFeedId);
    const snapshotJson = await readOptionalFile(path.join(directoryPath, 'snapshot.json'));
    if (snapshotJson === null) {
      return null;
    }

    const statusJson = await readOptionalFile(path.join(directoryPath, 'status.json'));
    const snapshot = parseSnapshot(snapshotJson);
    const status = statusJson === null ? null : parseStatus(statusJson);
    if (snapshot.id !== generatedFeedId || (status && status.id !== generatedFeedId)) {
      throw new Error(`生成フィード「${generatedFeedId}」の保存済みIDが一致しません`);
    }

    return {
      snapshot,
      status,
    };
  }

  public async reset(rootDirectoryPath: string): Promise<void> {
    await fs.rm(rootDirectoryPath, { recursive: true, force: true });
    await fs.mkdir(rootDirectoryPath, { recursive: true });
  }

  public async writeAvailable(
    rootDirectoryPath: string,
    generatedFeedId: string,
    feeds: FeedDistributionSet,
    snapshot: GeneratedFeedSnapshot,
    status: GeneratedFeedStatus,
  ): Promise<void> {
    assertGeneratedFeedId(generatedFeedId);
    const directoryPath = path.join(rootDirectoryPath, generatedFeedId);
    await fs.mkdir(directoryPath, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(directoryPath, 'atom.xml'), feeds.atom, 'utf-8'),
      fs.writeFile(path.join(directoryPath, 'rss.xml'), feeds.rss, 'utf-8'),
      fs.writeFile(path.join(directoryPath, 'feed.json'), feeds.json, 'utf-8'),
      fs.writeFile(path.join(directoryPath, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8'),
      fs.writeFile(path.join(directoryPath, 'status.json'), `${JSON.stringify(status, null, 2)}\n`, 'utf-8'),
    ]);
  }

  public async writeUnavailable(
    rootDirectoryPath: string,
    generatedFeedId: string,
    status: GeneratedFeedStatus,
  ): Promise<void> {
    assertGeneratedFeedId(generatedFeedId);
    const directoryPath = path.join(rootDirectoryPath, generatedFeedId);
    await fs.mkdir(directoryPath, { recursive: true });
    await fs.writeFile(path.join(directoryPath, 'status.json'), `${JSON.stringify(status, null, 2)}\n`, 'utf-8');
  }
}
