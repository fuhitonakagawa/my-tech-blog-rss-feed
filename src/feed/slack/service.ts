import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FeedValidator } from '../feed-validator';
import { logger } from '../logger';
import { slackFeedConfig, slackSourcePath, validateRssOutputPath } from './config';
import { bootstrapSlackFeed, buildSlackRss, updateSlackFeed } from './model';
import { parseSlackState, readSlackState } from './state-store';
import type { SlackFeedState, SlackSource } from './types';

/** RSSと履歴を、ファイルごとに完全な内容へ置き換える。 */
const writeOutput = async (file: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, content, 'utf-8');
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
};

/** 公開チェックアウトがある場合は、その履歴だけを通知日時の基準とする。 */
const hasDirectory = async (directory: string): Promise<boolean> => {
  try {
    const info = await fs.lstat(directory);
    if (!info.isDirectory()) throw new Error('公開履歴のディレクトリが不正です');
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
};

/** 初期化時は公開済みJSONから既存記事を識別する。 */
const publishedSource = async (directory: string, source: SlackSource): Promise<SlackSource | null> => {
  const rssPath = path.join(directory, slackSourcePath(source.rssUrl));
  try {
    return { ...source, json: await fs.readFile(rssPath.replace(/rss\.xml$/, 'feed.json'), 'utf-8') };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    try {
      await fs.access(rssPath);
    } catch (missing) {
      if ((missing as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw missing;
    }
    throw new Error('公開済みRSSに対応するJSONがありません');
  }
};

/** 全RSSを検証してから通知用出力を更新する。 */
export const generateSlackFeeds = async (
  sources: readonly SlackSource[],
  publishedDirectory: string,
  outputDirectory: string,
  now = new Date(),
): Promise<SlackFeedState> => {
  const usePublished = await hasDirectory(publishedDirectory);
  const historyPath = path.join(outputDirectory, 'feeds/delivery');
  const previous = await readSlackState(usePublished ? path.join(publishedDirectory, 'feeds/delivery') : historyPath);
  if (previous && Date.parse(previous.updatedAt) > now.getTime() + 60_000)
    throw new Error('Slack配信履歴より実行時刻が古くなっています');
  const state: SlackFeedState = {
    schemaVersion: 1,
    updatedAt: new Date(Math.max(now.getTime(), previous ? Date.parse(previous.updatedAt) : 0)).toISOString(),
    feeds: {},
  };
  const outputs = new Map<string, string>();
  const validator = new FeedValidator();
  for (const source of sources) {
    const key = slackSourcePath(source.rssUrl);
    validateRssOutputPath(source.rssUrl, source.rssPath);
    if (state.feeds[key]) throw new Error('Slack配信元が重複しています');
    let baseline = previous?.feeds[key];
    if (!baseline && usePublished) {
      const oldSource = await publishedSource(publishedDirectory, source);
      if (oldSource) baseline = bootstrapSlackFeed(oldSource, now);
    }
    const history = updateSlackFeed(source, baseline, now);
    state.feeds[key] = history;
    if (history.lastIssuedAt > state.updatedAt) state.updatedAt = history.lastIssuedAt;
    const xml = buildSlackRss(source.rssUrl, history);
    await validator.assertXmlFeed(`slack-${key}`, xml);
    outputs.set(source.rssPath, xml);
  }
  const json = `${JSON.stringify(state)}\n`;
  if (Buffer.byteLength(json) > slackFeedConfig.maxStateBytes) throw new Error('Slack配信履歴の保存上限を超えています');
  parseSlackState(json);
  for (const [key, xml] of outputs) {
    const file = path.join(outputDirectory, key);
    await writeOutput(file, xml);
  }
  await writeOutput(path.join(historyPath, 'state.json'), json);
  logger.info('[slack-feeds] generated', { feeds: sources.length });
  return state;
};
