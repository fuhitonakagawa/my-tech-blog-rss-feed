import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import constants from '../../../src/common/constants';
import { slackFeedConfig } from '../../../src/feed/slack/config';
import { updateSlackFeed } from '../../../src/feed/slack/model';
import { readSlackShards, serializeSlackShards, writeSlackShards } from '../../../src/feed/slack/state-shards';
import { readSlackState, serializeSlackState } from '../../../src/feed/slack/state-store';
import type { SlackFeedState } from '../../../src/feed/slack/types';

let directory: string;
const now = new Date('2026-10-08T12:00:00.000Z');
const state = (): SlackFeedState => {
  const feeds: SlackFeedState['feeds'] = {};
  for (const name of ['a', 'b']) {
    const key = `rss/${name}/feeds/rss.xml`;
    feeds[key] = updateSlackFeed(
      {
        rssUrl: `${constants.siteUrl}${key}`,
        rssPath: `section-feeds/${name}/feeds/rss.xml`,
        json: JSON.stringify({
          title: name,
          items: [
            {
              id: `https://example.com/${name}`,
              url: `https://example.com/${name}`,
              title: name,
              summary: '本文'.repeat(1000),
              date_published: now.toISOString(),
            },
          ],
        }),
      },
      undefined,
      now,
    );
  }
  return { schemaVersion: 1, updatedAt: now.toISOString(), feeds };
};
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rss-shards-'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});

it('全履歴が単一ファイル上限を超えてもフィード単位で保存し、GUIDと日時を保持する', async () => {
  const input = state();
  const single = { ...input, feeds: { 'rss/a/feeds/rss.xml': input.feeds['rss/a/feeds/rss.xml'] } };
  const original = slackFeedConfig.maxDecodedStateBytes;
  slackFeedConfig.maxDecodedStateBytes = Buffer.byteLength(JSON.stringify(single)) + 10;
  try {
    await expect(serializeSlackState(input)).rejects.toThrow('展開上限');
    const files = await serializeSlackShards(input);
    await writeSlackShards(path.join(directory, 'delivery'), files);
    expect(await readSlackState(path.join(directory, 'delivery'))).toEqual(input);
    const manifest = JSON.parse(String(files.get('index.json')));
    expect(manifest.metrics.decodedBytes).toBeGreaterThan(slackFeedConfig.maxDecodedStateBytes);
  } finally {
    slackFeedConfig.maxDecodedStateBytes = original;
  }
});

it.each(['hash', 'missing', 'path', 'symlink'])('破損した分割履歴から旧JSONへ切り替えない: %s', async (kind) => {
  const input = state();
  const target = path.join(directory, 'delivery');
  const files = await serializeSlackShards(input);
  await writeSlackShards(target, files);
  await fs.writeFile(path.join(target, 'state.json'), JSON.stringify(input));
  const manifest = JSON.parse(String(files.get('index.json')));
  const shard = Object.values(manifest.feeds)[0] as { file: string };
  const file = path.join(target, shard.file);
  if (kind === 'hash') await fs.writeFile(file, Buffer.alloc((await fs.stat(file)).size));
  if (kind === 'missing') await fs.unlink(file);
  if (kind === 'path') {
    shard.file = '../state.json';
    await fs.writeFile(path.join(target, 'index.json'), JSON.stringify(manifest));
  }
  if (kind === 'symlink') {
    await fs.unlink(file);
    await fs.symlink(path.join(target, 'state.json'), file);
  }
  await expect(readSlackState(target)).rejects.toThrow();
});

it('書き込み前の検証失敗では前世代を残し、一時ディレクトリを削除する', async () => {
  const target = path.join(directory, 'delivery');
  const input = state();
  await writeSlackShards(target, await serializeSlackShards(input));
  await expect(writeSlackShards(target, new Map([['../escape', 'invalid']]))).rejects.toThrow('保存先');
  expect(await readSlackShards(target)).toEqual(input);
  expect(await fs.readdir(directory)).toEqual(['delivery']);
});
