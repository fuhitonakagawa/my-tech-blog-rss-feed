import { expect, it } from 'vitest';
import { extractMongoDbBlog } from '../../../src/feed/generated/mongodb-blog';
import { GENERATED_FEED_DEFINITION_MAP } from '../../../src/resources/generated-feed-list';

const html = (value: unknown): string =>
  `<script type="text/template">${JSON.stringify(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</script>`;

it('公開ページの一覧から公開日と元URLを取得し、不正記事・重複を除く', () => {
  const definition = GENERATED_FEED_DEFINITION_MAP.get('mongodb-blog');
  if (!definition) throw new Error('定義がありません');
  const good = {
    url: '/company/blog/good',
    title: 'MongoDB & AI',
    published_at: '2026-09-29',
    summary: '概要',
    channelTags: ['AI'],
  };
  const items = extractMongoDbBlog(
    definition,
    html({
      contentstack: [
        good,
        good,
        { ...good, url: 'https://other.example.com/company/blog/escape' },
        { ...good, url: '/company/blog/invalid', published_at: '2026-02-30' },
        { ...good, url: '/company/blog/private?token=secret' },
      ],
      posts: [{ ...good, url: '/company/blog/draft', status: 'draft' }],
    }),
  );
  expect(items).toEqual([
    {
      id: 'https://www.mongodb.com/company/blog/good',
      url: 'https://www.mongodb.com/company/blog/good',
      title: 'MongoDB & AI',
      publishedAt: '2026-09-29T00:00:00.000Z',
      summary: '概要',
      categories: ['AI'],
      creator: '',
    },
  ]);
  expect(() => extractMongoDbBlog(definition, html({ contentstack: [] }))).toThrow('公開記事');
});
