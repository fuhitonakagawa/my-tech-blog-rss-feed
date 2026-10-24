import RssParser from 'rss-parser';
import { afterEach, expect, it, vi } from 'vitest';
import { logger } from '../../src/feed/logger';
import { parseRemoteFeed } from '../../src/feed/remote-feed-input';
import { FeedHttpError } from '../../src/feed/source-request';
import { providerCheck } from '../external/provider-check';

const url = 'https://example.com/feed.xml';
afterEach(() => vi.restoreAllMocks());

it.for([
  new FeedHttpError(403),
  new FeedHttpError(408),
  new FeedHttpError(429),
  new FeedHttpError(500),
  new FeedHttpError(502),
  new FeedHttpError(503),
  new FeedHttpError(504),
  new DOMException('request timed out', 'TimeoutError'),
  new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } }),
])('外部取得不能は成功とせず、対象と理由を記録して未検証にする: %s', async (error, context) => {
  const skipped = new Error('test skip');
  const skip = vi.spyOn(context, 'skip').mockImplementation(() => {
    throw skipped;
  });
  const warning = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  const run = vi.fn().mockRejectedValue(error);

  await expect(providerCheck(url, context, run)).rejects.toBe(skipped);
  expect(run).toHaveBeenCalledTimes(1);
  expect(skip).toHaveBeenCalledWith(`${error.name}: ${error.message}`);
  expect(context.task.meta).toMatchObject({ unverifiedSource: { url, reason: `${error.name}: ${error.message}` } });
  expect(warning).toHaveBeenCalledWith(expect.stringContaining('未検証'), expect.objectContaining({ url }));
});

it.for([
  new FeedHttpError(400),
  new FeedHttpError(401),
  new FeedHttpError(404),
  new SyntaxError('invalid XML'),
  new TypeError('invalid URL'),
  new Error('接続先が公開IPアドレスではありません'),
  new Error('レスポンスのサイズが上限を超えました'),
])('入力・解析・接続先検証の失敗は未検証に変えない: %s', async (error, context) => {
  const skip = vi.spyOn(context, 'skip');
  await expect(providerCheck(url, context, async () => Promise.reject(error))).rejects.toBe(error);
  expect(skip).not.toHaveBeenCalled();
  expect(context.task.meta).not.toHaveProperty('unverifiedSource');
});

it('取得成功時は本文をそのまま渡し、不正XMLは後続の解析で失敗する', async (context) => {
  const skip = vi.spyOn(context, 'skip');
  const xml = '<rss><channel></rss>';
  const body = await providerCheck(url, context, async () => xml);
  expect(body).toBe(xml);
  await expect(parseRemoteFeed(body, new RssParser(), 'broken feed')).rejects.toThrow();
  expect(skip).not.toHaveBeenCalled();
  expect(context.task.meta).not.toHaveProperty('unverifiedSource');
});
