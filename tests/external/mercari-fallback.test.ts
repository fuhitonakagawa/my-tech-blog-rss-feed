import { expect, it } from 'vitest';
import { fetchMercariFallback } from '../../src/feed/mercari-fallback';
import { SourceRequestQueue } from '../../src/feed/source-request';

it('メルカリ公式一覧から記事URLと日本時間の公開日時を取得できる', async () => {
  const feed = await fetchMercariFallback(new SourceRequestQueue());
  expect(feed.items.length).toBeGreaterThan(0);
  expect(
    feed.items.every(
      (item) =>
        item.link.startsWith('https://engineering.mercari.com/blog/entry/') &&
        Number.isFinite(Date.parse(item.isoDate)),
    ),
  ).toBe(true);
});
