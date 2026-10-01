import { expect, it } from 'vitest';
import { extractLeaderobot } from '../../../src/feed/generated/leaderobot';
import { GENERATED_FEED_DEFINITION_MAP } from '../../../src/resources/generated-feed-list';

const definition = GENERATED_FEED_DEFINITION_MAP.get('leaderobot-news');
if (!definition) throw new Error('定義がありません');
const good = {
  id: 10,
  title: '机器人 & AI',
  publishTime: '2026-09-30',
  createTime: '2026-10-01 09:00:00',
  updateTime: '2026-10-02 09:00:00',
  publishStatus: 'PUBLISH',
  isDelete: 'ACTIVE',
  description: '公开消息',
  tags: [{ name: '具身智能' }],
};
const html = (items: unknown[]): string =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { fallback: { '"newsList"': { items } } } } })}</script>`;

it('公開日を中国標準時で保持し、更新日時や作成日時を公開日に代用しない', () => {
  const items = extractLeaderobot(
    definition,
    html([
      good,
      good,
      { ...good, id: 11, publishStatus: 'DRAFT' },
      { ...good, id: 12, isDelete: 'DELETED' },
      { ...good, id: 13, publishTime: '2026-02-30' },
      { ...good, id: '../secret' },
      { ...good, id: 14, publishTime: '' },
    ]),
  );
  expect(items).toEqual([
    {
      id: 'https://www.leaderobot.com/news/10',
      url: 'https://www.leaderobot.com/news/10',
      title: good.title,
      publishedAt: '2026-09-29T16:00:00.000Z',
      summary: good.description,
      creator: '',
      categories: ['具身智能'],
    },
  ]);
});

it('一覧構造の欠落や公開記事0件を成功として扱わない', () => {
  expect(() => extractLeaderobot(definition, '<html>Access denied</html>')).toThrow();
  expect(() => extractLeaderobot(definition, html([]))).toThrow();
});
