import { afterEach, expect, it, vi } from 'vitest';
import constants from '../../../src/common/constants';
import { updateSlackFeed } from '../../../src/feed/slack/model';
import {
  type ReceiptState,
  SlackReceiptClient,
  mergeReceiptStates,
  monitorSlackReceipts,
  parseReceiptState,
  receiptTargets,
} from '../../../src/feed/slack/receipt-monitor';
import type { SlackFeedState } from '../../../src/feed/slack/types';

const now = new Date('2026-10-08T12:00:00.000Z');
const initial = (): ReceiptState => ({
  schemaVersion: 1,
  updatedAt: '2026-10-08T09:00:00.000Z',
  pending: {},
  confirmed: {},
});
const published = (at = '2026-10-08T09:00:00.000Z'): SlackFeedState => ({
  schemaVersion: 1,
  updatedAt: now.toISOString(),
  feeds: Object.fromEntries(
    receiptTargets.map(({ feed }) => [
      feed,
      updateSlackFeed(
        {
          rssUrl: `${constants.siteUrl}${feed}`,
          rssPath: feed,
          json: JSON.stringify({
            title: feed,
            items: [
              {
                id: `https://example.com/${feed}`,
                url: `https://example.com/${feed}`,
                title: '記事 <@here>',
                date_published: at,
              },
            ],
          }),
        },
        undefined,
        new Date(at),
      ),
    ]),
  ),
});
afterEach(() => {
  vi.useRealTimers();
});

it('URLが実投稿にある記事は再送せず、未着だけ再送して再実行でも増やさない', async () => {
  const input = published();
  const state = initial();
  const client = {
    history: vi
      .fn()
      .mockImplementation(async (channel: string) =>
        channel === receiptTargets[0].channel
          ? [{ attachments: [{ title_link: input.feeds[receiptTargets[0].feed].items[0].url }] }]
          : [],
      ),
    post: vi.fn().mockResolvedValue(undefined),
  };
  expect(await monitorSlackReceipts(state, input, client, now)).toEqual({ confirmed: 1, resent: 5, pending: 0 });
  expect(client.post).toHaveBeenCalledTimes(5);
  expect(await monitorSlackReceipts(parseReceiptState(JSON.stringify(state)), input, client, now)).toEqual({
    confirmed: 0,
    resent: 0,
    pending: 0,
  });
  expect(client.post).toHaveBeenCalledTimes(5);
});

it('90分のRSS巡回猶予中は再送せず、RSSから消えた未着も次回以降に保持する', async () => {
  const state = initial();
  const input = published('2026-10-08T11:00:00.000Z');
  const client = { history: vi.fn().mockResolvedValue([]), post: vi.fn().mockResolvedValue(undefined) };
  expect((await monitorSlackReceipts(state, input, client, now)).pending).toBe(6);
  expect(client.post).not.toHaveBeenCalled();
  for (const feed of Object.values(input.feeds)) feed.items = [];
  await monitorSlackReceipts(state, input, client, new Date('2026-10-30T12:00:00.000Z'));
  expect(client.post).toHaveBeenCalledTimes(6);
  expect(Object.keys(state.pending)).toHaveLength(0);
});

it('保存失敗した未着候補をバックアップから復元し、確認済みの記事は戻さない', async () => {
  const backup = initial();
  const client = { history: vi.fn().mockResolvedValue([]), post: vi.fn() };
  await monitorSlackReceipts(backup, published('2026-10-08T11:00:00.000Z'), client, now);
  const current = { ...initial(), updatedAt: now.toISOString() };
  const key = Object.keys(backup.pending)[0];
  current.confirmed[key] = now.toISOString();
  const merged = mergeReceiptStates(current, backup);
  expect(Object.keys(merged.pending)).toHaveLength(5);
  expect(merged.pending[key]).toBeUndefined();
  expect(parseReceiptState(JSON.stringify(merged))).toEqual(merged);
});

it('曖昧な投稿失敗を直ちに再送せず、次回の履歴確認で受信済みと判断する', async () => {
  const state = initial();
  const input = published();
  const client = { history: vi.fn().mockResolvedValue([]), post: vi.fn().mockRejectedValueOnce(new Error('timeout')) };
  await expect(monitorSlackReceipts(state, input, client, now)).rejects.toThrow('timeout');
  expect(Object.keys(parseReceiptState(JSON.stringify(state)).pending)).toHaveLength(6);
  client.history.mockImplementation(async () =>
    Object.values(input.feeds).flatMap((feed) => feed.items.map((article) => ({ text: article.url }))),
  );
  await monitorSlackReceipts(state, input, client, now);
  expect(client.post).toHaveBeenCalledTimes(1);
  expect(Object.keys(state.pending)).toHaveLength(0);
});

it('Slack履歴の全ページを読み、429を待ち、途中失敗を受信済みにしない', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '1' } }))
    .mockResolvedValueOnce(
      Response.json({
        ok: true,
        messages: [{ text: 'first' }],
        has_more: true,
        response_metadata: { next_cursor: 'next' },
      }),
    )
    .mockResolvedValueOnce(Response.json({ ok: true, messages: [{ text: 'last' }] }));
  const pause = vi.fn().mockResolvedValue(undefined);
  const client = new SlackReceiptClient('test-token', fetcher, pause);
  expect(await client.history(receiptTargets[0].channel, '0')).toEqual([{ text: 'first' }, { text: 'last' }]);
  expect(pause).toHaveBeenCalledWith(1000);
  fetcher.mockResolvedValue(Response.json({ ok: false, error: 'missing_scope' }));
  await expect(client.history(receiptTargets[0].channel, '0')).rejects.toThrow('missing_scope');
});

it('投稿失敗を再試行せず、メンションを無効にし、同じ記事に同じ送信IDを使う', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 502 }));
  const client = new SlackReceiptClient('test-token', fetcher);
  const article = published().feeds[receiptTargets[0].feed].items[0];
  await expect(client.post(receiptTargets[0].channel, article, 'same-id')).rejects.toThrow('HTTP 502');
  expect(fetcher).toHaveBeenCalledTimes(1);
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body).toMatchObject({ parse: 'none', client_msg_id: 'same-id', unfurl_links: false });
  expect(body.text).toContain('&lt;@here&gt;');
});
