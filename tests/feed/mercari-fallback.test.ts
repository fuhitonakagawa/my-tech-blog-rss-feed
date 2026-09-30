import { expect, it } from 'vitest';
import { parseMercariIndex } from '../../src/feed/mercari-fallback';

const html = (posts: unknown[]): string =>
  `<astro-island props='${JSON.stringify({ posts: [1, posts] }).replaceAll("'", '&#39;')}'></astro-island>`;
const post = (slug: string, published = '2026-09-30T14:54:45'): unknown => [
  0,
  {
    slug: [0, slug],
    title: [0, '記事 😀'],
    published: [0, published],
  },
];

it('公式一覧の日本時間・記事URLを保持し、注目記事との重複を除く', () => {
  const feed = parseMercariIndex(html([post('article')]) + html([post('article'), post('another')]));
  expect(feed.items).toHaveLength(2);
  expect(feed.items[0]).toMatchObject({
    link: 'https://engineering.mercari.com/blog/entry/article/',
    isoDate: '2026-09-30T05:54:45.000Z',
    title: '記事 😀',
  });
});

it('欠落日付・不正日付・外部URL・階層移動を公開記事にしない', () => {
  const feed = parseMercariIndex(
    html([
      post('good'),
      post('../other'),
      post('https://example.com/'),
      post('bad-day', '2026-02-30T12:00:00'),
      post('date-only', '2026-09-30'),
      post('missing', ''),
      [0, { slug: [0, 'no-title'] }],
    ]),
  );
  expect(feed.items.map((item) => item.link)).toEqual(['https://engineering.mercari.com/blog/entry/good/']);
  expect(() => parseMercariIndex('<html>Access denied</html>')).toThrow();
  expect(() => parseMercariIndex('<astro-island props="broken"></astro-island>')).toThrow();
});
