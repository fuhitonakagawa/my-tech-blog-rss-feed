import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readSlackState } from './state-store';
import type { SlackFeedState } from './types';

/** 公開チェックアウトがあれば未公開のローカル履歴を採用しない。 */
export const loadDeliveryHistory = async (
  publishedDirectory: string,
  outputDirectory: string,
  now: Date,
): Promise<{ usePublished: boolean; previous: SlackFeedState | null }> => {
  let usePublished = false;
  try {
    const info = await fs.lstat(publishedDirectory);
    if (!info.isDirectory()) throw new Error('公開履歴のディレクトリが不正です');
    usePublished = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const previous = await readSlackState(
    path.join(usePublished ? publishedDirectory : outputDirectory, 'feeds/delivery'),
  );
  if (previous && Date.parse(previous.updatedAt) > now.getTime() + 60_000)
    throw new Error('Slack配信履歴より実行時刻が古くなっています');
  return { usePublished, previous };
};
