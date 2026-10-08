import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createServer } from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import EleventyFetch from '@11ty/eleventy-fetch';
import { Agent, type Dispatcher } from 'undici';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { imageCacheOptions } from '../../src/common/eleventy-cache-option';
import { publicNetworkDispatcher } from '../../src/common/url-guard';
import { type CustomOgObject, FeedCrawler } from '../../src/feed/feed-crawler';

const location = vi.hoisted(() => ({ directory: '' }));
vi.mock('../../src/common/url-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/common/url-guard')>();
  return {
    ...actual,
    publicNetworkDispatcher: {
      dispatch: (...args: Parameters<Dispatcher['dispatch']>) => actual.publicNetworkDispatcher.dispatch(...args),
    },
  };
});
vi.mock('flat-cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('flat-cache')>();
  return {
    ...actual,
    create: (options: Parameters<typeof actual.create>[0]) =>
      actual.create({ ...options, cacheDir: location.directory }),
  };
});

const originalConcurrency = EleventyFetch.concurrency;
beforeEach(async () => {
  location.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fetch-timeouts-'));
});
afterEach(async () => {
  EleventyFetch.concurrency = originalConcurrency;
  vi.restoreAllMocks();
  vi.useRealTimers();
  await fs.rm(location.directory, { recursive: true, force: true });
});

it('OGPの本文停止を期限で中断し、後続取得と同じURLの再試行が成功する', async () => {
  let requests = 0;
  let bodyStarted = false;
  const bodyTimeout = new AbortController();
  let bodyTimer: NodeJS.Timeout | undefined;
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'text/html');
    if (++requests === 1) {
      response.write('<html><head>');
      bodyStarted = true;
      // 接続初期化の遅延と分け、本文開始後の停止を確実に検証する。
      bodyTimer = setTimeout(() => bodyTimeout.abort(new DOMException('本文の取得期限', 'TimeoutError')), 500);
    } else {
      response.end('<html><head><meta property="og:title" content="Healthy"></head><body>ok</body></html>');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('テストサーバーのアドレスが不正です');
  const agent = new Agent();
  // HTTPと本文処理は実ライブラリを通し、接続先だけを隔離したテストサーバーへ向ける。
  const dispatch = vi
    .spyOn(publicNetworkDispatcher, 'dispatch')
    .mockImplementation((options, handler) =>
      agent.dispatch({ ...options, origin: `http://127.0.0.1:${address.port}` }, handler),
    );
  const originalTimeout = AbortSignal.timeout.bind(AbortSignal);
  const timeout = vi
    .spyOn(AbortSignal, 'timeout')
    .mockImplementation(() => originalTimeout(500))
    .mockImplementationOnce(() => bodyTimeout.signal);
  const crawler = FeedCrawler as unknown as { fetchOgObject(url: string): Promise<CustomOgObject> };
  try {
    await expect(crawler.fetchOgObject('https://example.com/slow')).rejects.toThrow('OGの取得に失敗');
    expect(bodyStarted).toBe(true);
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect((await crawler.fetchOgObject('https://example.com/healthy')).ogTitle).toBe('Healthy');
    expect((await crawler.fetchOgObject('https://example.com/slow')).ogTitle).toBe('Healthy');
    expect(requests).toBe(3);
  } finally {
    clearTimeout(bodyTimer);
    dispatch.mockRestore();
    server.closeAllConnections();
    await agent.destroy();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}, 10_000);

it('画像本文の停止を中断し、待機キューの後続画像と同じURLの再試行には新しい期限を使う', async () => {
  vi.useFakeTimers();
  EleventyFetch.concurrency = 1;
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('取得期限', 'TimeoutError')), milliseconds);
    return controller.signal;
  });
  const signals: AbortSignal[] = [];
  let bodyAborted = false;
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    const signal = options?.signal;
    if (!signal) throw new Error('取得期限がありません');
    expect(options).toEqual(expect.objectContaining({ dispatcher: publicNetworkDispatcher }));
    signals.push(signal);
    if (signals.length > 1) return new Response('healthy-image');
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
          signal.addEventListener(
            'abort',
            () => {
              bodyAborted = true;
              controller.error(signal.reason);
            },
            { once: true },
          );
        },
      }),
    );
  });
  const base = `https://example.com/${randomUUID()}`;
  const options = { ...imageCacheOptions, type: 'buffer' as const, directory: location.directory, dryRun: true };
  const slow = EleventyFetch(`${base}/slow.png`, options);
  const healthy = EleventyFetch(`${base}/healthy.png`, options);
  const results = Promise.allSettled([slow, healthy]);
  await vi.advanceTimersByTimeAsync(9_999);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(bodyAborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  const [failed, succeeded] = await results;
  expect(failed.status).toBe('rejected');
  expect(succeeded).toEqual({ status: 'fulfilled', value: Buffer.from('healthy-image') });
  expect(bodyAborted).toBe(true);
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
  expect(signals[0]).not.toBe(signals[1]);
  await expect(EleventyFetch(`${base}/slow.png`, options)).resolves.toEqual(Buffer.from('healthy-image'));
  expect(signals[2].aborted).toBe(false);
  expect(signals[2]).not.toBe(signals[0]);
});
