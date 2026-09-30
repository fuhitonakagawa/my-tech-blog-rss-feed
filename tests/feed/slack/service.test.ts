import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import Parser from 'rss-parser';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import constants from '../../../src/common/constants';
import { logger } from '../../../src/feed/logger';
import { loadDeliveryHistory } from '../../../src/feed/slack/history';
import { generateSlackFeeds } from '../../../src/feed/slack/service';
import { parseSlackState, readSlackState } from '../../../src/feed/slack/state-store';
import type { SlackSource } from '../../../src/feed/slack/types';

let directory: string;
let published: string;
let output: string;
const source = (urls: string[]): SlackSource => ({
  rssUrl: `${constants.siteUrl}rss/ai-jp/feeds/rss.xml`,
  rssPath: 'translated-feeds/ai-jp/feeds/rss.xml',
  json: JSON.stringify({
    title: 'AI',
    items: urls.map((url) => ({ id: url, url, title: '記事', date_published: '2026-09-20T00:00:00.000Z' })),
  }),
});
const now = new Date('2026-09-29T07:00:00.000Z');

it('生成不能でも有効な通知履歴を保持し、復旧時のGUIDと初回掲載日時を変えない', async () => {
  const input = {
    ...source(['https://example.com/generated']),
    rssUrl: `${constants.siteUrl}feeds/generated/test-blog/rss.xml`,
    rssPath: 'feeds/generated/test-blog/rss.xml',
  };
  const first = await generateSlackFeeds([input], published, output, now);
  await fs.cp(output, published, { recursive: true });
  await fs.rm(path.join(output, 'feeds/generated'), { recursive: true });
  const unavailable = await generateSlackFeeds([], published, output, new Date(now.getTime() + 3600_000), [
    'test-blog',
  ]);
  const key = 'feeds/generated/test-blog/rss.xml';
  expect(unavailable.feeds[key]).toEqual(first.feeds[key]);
  await expect(fs.access(path.join(output, input.rssPath))).rejects.toMatchObject({ code: 'ENOENT' });
  await fs.rm(published, { recursive: true });
  await fs.cp(output, published, { recursive: true });
  const restored = await generateSlackFeeds([input], published, output, new Date(now.getTime() + 7200_000));
  expect(restored.feeds[key].items[0]).toMatchObject({
    guid: first.feeds[key].items[0].guid,
    firstSeenAt: first.feeds[key].items[0].firstSeenAt,
  });
  const expired = await generateSlackFeeds([], published, output, new Date(now.getTime() + 91 * 86400_000), [
    'test-blog',
  ]);
  expect(expired.feeds[key].items).toEqual([]);
  expect(expired.feeds[key].seen).toEqual({});
  const removed = await generateSlackFeeds([], published, output, new Date(now.getTime() + 7200_000));
  expect(removed.feeds).toEqual({});
});

it.each(['\uFFFE', '\uFFFF', '\uD800'])('公開済み履歴のXML禁止文字を黙って補正しない: %j', async (invalid) => {
  const state = await generateSlackFeeds([source(['https://example.com/a'])], published, output, now);
  const key = 'rss/ai-jp/feeds/rss.xml';
  state.feeds[key].items[0].title += invalid;
  expect(() => parseSlackState(JSON.stringify(state))).toThrow('記事が不正');
});

it('表示上限で絵文字が切れても不正なサロゲートを履歴へ保存しない', async () => {
  const input = source(['https://example.com/a']);
  const feed = JSON.parse(input.json);
  feed.items[0].title = `${'a'.repeat(1999)}😀`;
  feed.items[0].tags = [`${'b'.repeat(1999)}😀`];
  input.json = JSON.stringify(feed);
  const state = await generateSlackFeeds([input], published, output, now);
  expect(state.feeds['rss/ai-jp/feeds/rss.xml'].items[0]).toMatchObject({
    title: 'a'.repeat(1999),
    tags: ['b'.repeat(1999)],
  });
  expect(parseSlackState(JSON.stringify(state))).toEqual(state);
});
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'slack-delivery-'));
  published = path.join(directory, 'published');
  output = path.join(directory, 'output');
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});

it('既存URLへの移行で公開済み記事を再通知せず、後着記事だけ新しい日時にする', async () => {
  const prior = source(['https://example.com/existing']);
  const feedDirectory = path.join(published, 'rss/ai-jp/feeds');
  await fs.mkdir(feedDirectory, { recursive: true });
  await fs.writeFile(path.join(feedDirectory, 'feed.json'), prior.json);
  const input = source(['https://example.com/existing', 'https://example.com/late']);
  await generateSlackFeeds([input], published, output, now);
  const parser = new Parser();
  const rss = await parser.parseString(await fs.readFile(path.join(output, input.rssPath), 'utf-8'));
  const existing = rss.items.find((item) => item.link?.endsWith('/existing'));
  const late = rss.items.find((item) => item.link?.endsWith('/late'));
  expect(existing?.guid).toBe('https://example.com/existing');
  expect(existing?.isoDate).toBe('2026-09-20T00:00:00.000Z');
  expect(late?.isoDate).toBe(now.toISOString());
  expect(late?.contentSnippet).toContain('2026/9/20');
  expect(rss.feedUrl).toBe(input.rssUrl);
  await expect(fs.stat(path.join(output, 'slack'))).rejects.toMatchObject({ code: 'ENOENT' });
});

it('公開済み履歴を復元し、未公開の出力履歴で初回掲載日時を巻き戻さない', async () => {
  const first = await generateSlackFeeds([source(['https://example.com/first'])], published, output, now);
  await fs.mkdir(published, { recursive: true });
  await fs.cp(output, published, { recursive: true });
  const sources = [source(['https://example.com/first', 'https://example.com/late'])];
  const failedDeployment = await generateSlackFeeds(sources, published, output, new Date('2026-09-29T08:00:00.000Z'));
  const next = await generateSlackFeeds(sources, published, output, new Date('2026-09-29T09:00:00.000Z'));
  const key = 'rss/ai-jp/feeds/rss.xml';
  expect(next.feeds[key].items.find((item) => item.url.endsWith('/first'))?.firstSeenAt).toBe(
    first.feeds[key].lastIssuedAt,
  );
  expect(next.feeds[key].items.find((item) => item.url.endsWith('/late'))?.firstSeenAt).toBe(
    '2026-09-29T09:00:00.000Z',
  );
  expect(next.feeds[key].lastIssuedAt).not.toBe(failedDeployment.feeds[key].lastIssuedAt);
  expect(await readSlackState(path.join(output, 'feeds/delivery'))).toEqual(next);
});

it('公開履歴が壊れている場合に正常なローカル履歴へ黙って切り替えない', async () => {
  await generateSlackFeeds([source(['https://example.com/a'])], published, output, now);
  await fs.mkdir(path.join(published, 'feeds/delivery'), { recursive: true });
  await fs.writeFile(path.join(published, 'feeds/delivery/state.json'), '{}');
  await expect(generateSlackFeeds([source([])], published, output, now)).rejects.toThrow();
});

it('初回の公開チェックアウトにSlack履歴がなければ未公開ローカル履歴を採用しない', async () => {
  await generateSlackFeeds([source(['https://example.com/a'])], published, output, now);
  await fs.mkdir(published, { recursive: true });
  const result = await generateSlackFeeds(
    [source(['https://example.com/a'])],
    published,
    output,
    new Date('2026-09-29T08:00:00.000Z'),
  );
  expect(result.feeds['rss/ai-jp/feeds/rss.xml'].lastIssuedAt).toBe('2026-09-29T08:00:00.000Z');
});

it('不正な入力では出力済みのRSSを上書きしない', async () => {
  await generateSlackFeeds([source(['https://example.com/a'])], published, output, now);
  const rssPath = path.join(output, 'translated-feeds/ai-jp/feeds/rss.xml');
  const before = await fs.readFile(rssPath, 'utf-8');
  await expect(
    generateSlackFeeds([source(['https://example.com/a?token=private'])], published, output, now),
  ).rejects.toThrow();
  expect(await fs.readFile(rssPath, 'utf-8')).toBe(before);
});

it('公開履歴のパス・記事URL・日時の不整合を拒否し、未知の情報を保持しない', async () => {
  const state = await generateSlackFeeds([source(['https://example.com/a'])], published, output, now);
  const key = 'rss/ai-jp/feeds/rss.xml';
  expect(JSON.stringify(parseSlackState(JSON.stringify({ ...state, privateField: 'private-value' })))).not.toContain(
    'private-value',
  );
  const wrongPath = { ...state, feeds: { '../escape/rss.xml': state.feeds[key] } };
  expect(() => parseSlackState(JSON.stringify(wrongPath))).toThrow();
  const wrongUrl = structuredClone(state);
  wrongUrl.feeds[key].items[0].url = 'https://example.com/a?access_token=private';
  expect(() => parseSlackState(JSON.stringify(wrongUrl))).toThrow();
  const wrongDate = structuredClone(state);
  wrongDate.feeds[key].items[0].firstSeenAt = '2026-09-28T00:00:00.000Z';
  expect(() => parseSlackState(JSON.stringify(wrongDate))).toThrow();
});

it('後続フィードが不正なら先行RSSも配信履歴も書き換えない', async () => {
  const original = source(['https://example.com/a']);
  await generateSlackFeeds([original], published, output, now);
  const files = [original.rssPath, 'feeds/delivery/state.json'];
  const before = await Promise.all(files.map((file) => fs.readFile(path.join(output, file), 'utf8')));
  const invalid = {
    ...source(['https://example.com/b?access_token=secret']),
    rssUrl: `${constants.siteUrl}rss/aws-jp/feeds/rss.xml`,
    rssPath: 'translated-feeds/aws-jp/feeds/rss.xml',
  };
  await expect(
    generateSlackFeeds([source(['https://example.com/new']), invalid], published, output, now),
  ).rejects.toThrow();
  expect(await Promise.all(files.map((file) => fs.readFile(path.join(output, file), 'utf8')))).toEqual(before);
  await expect(fs.access(path.join(output, invalid.rssPath))).rejects.toMatchObject({ code: 'ENOENT' });
});

it('同じ配信先が重複していればRSS・履歴を一切生成しない', async () => {
  await expect(generateSlackFeeds([source([]), source([])], published, output, now)).rejects.toThrow('重複');
  await expect(fs.access(output)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('公開済みRSSだけが残りJSONと履歴がない状態を初回扱いにしない', async () => {
  const file = path.join(published, 'rss/ai-jp/feeds/rss.xml');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, '<rss/>');
  await expect(generateSlackFeeds([source([])], published, output, now)).rejects.toThrow('JSONがありません');
  await expect(fs.access(output)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('RSSのファイル置換が失敗しても既存履歴を保持し、一時ファイルを残さない', async () => {
  const input = source(['https://example.com/a']);
  await generateSlackFeeds([input], published, output, now);
  const history = await fs.readFile(path.join(output, 'feeds/delivery/state.json'), 'utf8');
  const file = path.join(output, input.rssPath);
  await fs.unlink(file);
  await fs.mkdir(file);
  await expect(generateSlackFeeds([source(['https://example.com/b'])], published, output, now)).rejects.toThrow();
  expect(await fs.readFile(path.join(output, 'feeds/delivery/state.json'), 'utf8')).toBe(history);
  expect(await fs.readdir(path.dirname(file))).toEqual(['rss.xml']);
});

it.each([60_000, 60_001])('履歴時計が実行時刻より進んでいる場合は許容境界を守る: %dms', async (offset) => {
  await generateSlackFeeds([source([])], published, output, new Date(now.getTime() + offset));
  if (offset === 60_000) {
    const result = await generateSlackFeeds([source([])], published, output, now);
    expect(result.updatedAt).toBe(new Date(now.getTime() + offset).toISOString());
  } else {
    await expect(generateSlackFeeds([source([])], published, output, now)).rejects.toThrow('実行時刻が古く');
  }
});

it.each(['file', 'symlink'])('公開履歴ルートがディレクトリでなければローカルへ切り替えない: %s', async (kind) => {
  await generateSlackFeeds([source([])], published, output, now);
  if (kind === 'file') await fs.writeFile(published, 'invalid');
  else await fs.symlink(output, published);
  await expect(loadDeliveryHistory(published, output, now)).rejects.toThrow('ディレクトリが不正');
});

it.each(['missing', 'directory', 'symlink', 'oversized'])(
  '履歴ファイルの欠落・不正を初期化で隠さない: %s',
  async (kind) => {
    const validState = await generateSlackFeeds(
      [source([])],
      path.join(directory, 'absent'),
      path.join(directory, 'baseline'),
      now,
    );
    const validJson = JSON.stringify(validState);
    const stateDirectory = path.join(published, 'feeds/delivery');
    await fs.mkdir(stateDirectory, { recursive: true });
    const file = path.join(stateDirectory, 'state.json');
    if (kind === 'directory') await fs.mkdir(file);
    if (kind === 'symlink') {
      const target = path.join(directory, 'other.json');
      await fs.writeFile(target, validJson);
      await fs.symlink(target, file);
    }
    if (kind === 'oversized') {
      await fs.writeFile(file, validJson + ' '.repeat(64 * 1024 * 1024 + 1 - Buffer.byteLength(validJson)));
    }
    if (kind === 'missing') {
      await expect(generateSlackFeeds([source([])], published, output, now)).rejects.toMatchObject({ code: 'ENOENT' });
    } else {
      await expect(generateSlackFeeds([source([])], published, output, now)).rejects.toThrow('履歴のファイルが不正');
    }
    await expect(fs.access(output)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);
