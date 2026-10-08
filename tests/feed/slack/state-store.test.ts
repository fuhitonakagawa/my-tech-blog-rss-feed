import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import constants from '../../../src/common/constants';
import { slackFeedConfig } from '../../../src/feed/slack/config';
import { updateSlackFeed } from '../../../src/feed/slack/model';
import { readSlackState, serializeSlackState } from '../../../src/feed/slack/state-store';
import type { SlackFeedState } from '../../../src/feed/slack/types';

vi.mock('../../../src/feed/slack/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/feed/slack/config')>();
  return {
    ...actual,
    slackFeedConfig: { ...actual.slackFeedConfig, maxStateBytes: 4096, maxDecodedStateBytes: 32768 },
  };
});

let directory: string;
const now = new Date('2026-10-08T12:00:00.000Z');
const state = (summary = '内容'): SlackFeedState => ({
  schemaVersion: 1,
  updatedAt: now.toISOString(),
  feeds: {
    'feeds/rss.xml': updateSlackFeed(
      {
        rssUrl: `${constants.siteUrl}feeds/rss.xml`,
        rssPath: 'feeds/rss.xml',
        json: JSON.stringify({
          title: 'テスト',
          items: [
            {
              id: 'article-1',
              url: 'https://example.com/article',
              title: '記事',
              summary,
              date_published: '2026-10-08T00:00:00.000Z',
            },
          ],
        }),
      },
      undefined,
      now,
    ),
  },
});

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'slack-state-'));
});
afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

it('未圧縮JSONが保存上限を超えても、全記事と識別履歴を圧縮して復元する', async () => {
  const original = state('日本語の概要'.repeat(1000));
  expect(Buffer.byteLength(JSON.stringify(original))).toBeGreaterThan(slackFeedConfig.maxStateBytes);
  const content = await serializeSlackState(original);
  expect(content.byteLength).toBeLessThan(slackFeedConfig.maxStateBytes);
  expect(JSON.parse(gunzipSync(content).toString('utf8'))).toEqual(original);
  await fs.writeFile(path.join(directory, 'state.json.gz'), content);
  expect(await readSlackState(directory)).toEqual(original);
});

it('旧JSONを復元し、圧縮履歴が併存するときは新しい圧縮履歴を優先する', async () => {
  const legacy = state('旧履歴');
  await fs.writeFile(path.join(directory, 'state.json'), JSON.stringify(legacy));
  expect(await readSlackState(directory)).toEqual(legacy);
  const current = state('圧縮履歴');
  await fs.writeFile(path.join(directory, 'state.json.gz'), await serializeSlackState(current));
  expect(await readSlackState(directory)).toEqual(current);
});

it('圧縮で小さくても展開上限を超えるJSONを保存・復元しない', async () => {
  const oversized = state('あ'.repeat(slackFeedConfig.maxDecodedStateBytes / 2));
  await expect(serializeSlackState(oversized)).rejects.toThrow('展開上限');
  const content = gzipSync(JSON.stringify(oversized));
  expect(content.byteLength).toBeLessThan(slackFeedConfig.maxStateBytes);
  await fs.writeFile(path.join(directory, 'state.json.gz'), content);
  await expect(readSlackState(directory)).rejects.toMatchObject({ code: 'ERR_BUFFER_TOO_LARGE' });
});

it('展開後のUTF-8バイト数が上限と一致する履歴は復元でき、1バイト超過は拒否する', async () => {
  const overhead = Buffer.byteLength(JSON.stringify(state(''))) + 1;
  const original = state('a'.repeat(slackFeedConfig.maxDecodedStateBytes - overhead));
  const content = await serializeSlackState(original);
  expect(gunzipSync(content).byteLength).toBe(slackFeedConfig.maxDecodedStateBytes);
  await fs.writeFile(path.join(directory, 'state.json.gz'), content);
  expect(await readSlackState(directory)).toEqual(original);
  const oversized = `${JSON.stringify(original)}\n `;
  await fs.writeFile(path.join(directory, 'state.json.gz'), gzipSync(oversized));
  await expect(readSlackState(directory)).rejects.toMatchObject({ code: 'ERR_BUFFER_TOO_LARGE' });
});

it('圧縮後も保存上限を超える履歴は保存しない', async () => {
  await expect(serializeSlackState(state(randomBytes(8192).toString('base64')))).rejects.toThrow('保存上限');
});

it.each(['broken', 'truncated', 'invalid-state', 'symlink', 'directory'])(
  '圧縮履歴が不正な場合は旧JSONへ切り替えない: %s',
  async (kind) => {
    await fs.writeFile(path.join(directory, 'state.json'), JSON.stringify(state()));
    const file = path.join(directory, 'state.json.gz');
    if (kind === 'broken') await fs.writeFile(file, 'invalid gzip');
    if (kind === 'truncated') await fs.writeFile(file, (await serializeSlackState(state())).subarray(0, 20));
    if (kind === 'invalid-state') await fs.writeFile(file, gzipSync('{}'));
    if (kind === 'symlink') await fs.symlink(path.join(directory, 'state.json'), file);
    if (kind === 'directory') await fs.mkdir(file);
    await expect(readSlackState(directory)).rejects.toThrow();
  },
);

it('圧縮履歴も展開後の記事識別情報を検証する', async () => {
  const invalid = state();
  invalid.feeds['feeds/rss.xml'].items[0].firstSeenAt = '2026-10-07T00:00:00.000Z';
  await expect(serializeSlackState(invalid)).rejects.toThrow('既知記事が不整合');
  await fs.writeFile(path.join(directory, 'state.json.gz'), gzipSync(JSON.stringify(invalid)));
  await expect(readSlackState(directory)).rejects.toThrow('既知記事が不整合');
});
