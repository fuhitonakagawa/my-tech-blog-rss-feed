import { afterEach, describe, expect, it, vi } from 'vitest';
import constants from '../src/common/constants';
import { fetchGeneratedFeedPage } from '../src/feed/generated/page-fetcher';
import type { GeneratedFeedDefinition } from '../src/feed/generated/types';

const definition: GeneratedFeedDefinition = {
  id: 'test-blog',
  schemaVersion: 1,
  label: 'テストブログ',
  pageUrl: 'https://example.com/blog/',
  language: 'ja',
  extractor: {
    type: 'adapter',
    name: 'serverless-operations',
  },
  pollIntervalMinutes: 60,
  maxItems: 50,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchGeneratedFeedPage', () => {
  it('HTMLレスポンスを取得する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } })),
    );

    await expect(fetchGeneratedFeedPage(definition)).resolves.toBe('<html></html>');
  });

  it('HTTPエラーを拒否する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );

    await expect(fetchGeneratedFeedPage(definition)).rejects.toThrow('HTTP Error: 503');
  });

  it('HTML以外のレスポンスを拒否する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json' } })),
    );

    await expect(fetchGeneratedFeedPage(definition)).rejects.toThrow('HTMLではないレスポンスです');
  });

  it('上限を超えるContent-Lengthを拒否する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('', {
            headers: {
              'content-type': 'text/html',
              'content-length': String(constants.generatedFeedMaxResponseBytes + 1),
            },
          }),
      ),
    );

    await expect(fetchGeneratedFeedPage(definition)).rejects.toThrow('HTMLのレスポンスサイズが上限を超えています');
  });
});
