import { afterEach, expect, it, vi } from 'vitest';
import { FeedHttpError, SourceRequestQueue } from '../../src/feed/source-request';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('同じ配信元の開始間隔を守り、他サイトは独立して取得する', async () => {
  vi.useFakeTimers();
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('xml'));
  const queue = new SourceRequestQueue();
  const results = Promise.all([
    queue.fetchXml('https://one.example/a'),
    queue.fetchXml('https://one.example/b'),
    queue.fetchXml('https://two.example/c'),
  ]);
  await vi.advanceTimersByTimeAsync(499);
  expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(await results).toEqual(['xml', 'xml', 'xml']);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it.each(['3600', 'Wed, 30 Sep 2026 01:00:00 GMT'])(
  '429のRetry-After中は同じホストへ再送せず、期限後は復帰する: %s',
  async (retryAfter) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T00:00:00Z'));
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': retryAfter } }))
      .mockImplementation(async () => new Response('healthy'));
    const queue = new SourceRequestQueue();
    await expect(queue.fetchXml('https://one.example/a')).rejects.toMatchObject({ status: 429, retryable: false });
    await expect(queue.fetchXml('https://one.example/b')).rejects.toMatchObject({ status: 429 });
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(queue.fetchXml('https://two.example/a')).resolves.toBe('healthy');
    await vi.advanceTimersByTimeAsync(3600_000);
    await expect(queue.fetchXml('https://one.example/b')).resolves.toBe('healthy');
  },
);

it('恒久的なHTTP失敗を再試行せず、一時的なサーバー失敗は再試行できる', () => {
  expect(new FeedHttpError(404).retryable).toBe(false);
  expect(new FeedHttpError(403).retryable).toBe(false);
  expect(new FeedHttpError(503).retryable).toBe(true);
});
