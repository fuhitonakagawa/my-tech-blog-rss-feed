import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import Parser from 'rss-parser';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import constants from '../../../src/common/constants';
import { logger } from '../../../src/feed/logger';
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
