import { expect, it } from 'vitest';
import { fetchMercariFallback } from '../../src/feed/mercari-fallback';
import { SourceRequestQueue } from '../../src/feed/source-request';
import { providerCheck } from './provider-check';

it('メルカリ公式一覧から記事URLと日本時間の公開日時を取得できる', async (context) => {
  const feed = await providerCheck('https://engineering.mercari.com/blog/', context, () =>
    fetchMercariFallback(new SourceRequestQueue()),
  );
  expect(feed.items.length).toBeGreaterThan(0);
  expect(
    feed.items.every(
      (item) =>
        item.link.startsWith('https://engineering.mercari.com/blog/entry/') &&
        Number.isFinite(Date.parse(item.isoDate)),
    ),
  ).toBe(true);
});
