import { expect, it } from 'vitest';
import { DEDUPLICATED_FEED_DEFINITION_LIST, parseDeduplicatedFeeds } from '../src/resources/deduplicated-feed-list';
import { DISPLAY_SECTION_LIST } from '../src/resources/display-section-list';
import { FEED_SECTION_LIST } from '../src/resources/feed-info-list';

it('入力の和集合と優先度を定義し、取得元には自己参照を作らない', () => {
  const definitions = DEDUPLICATED_FEED_DEFINITION_LIST;
  expect(definitions).toHaveLength(6);
  expect(definitions.find((item) => item.id === 'my-tech-blog-jp-dedup')).toMatchObject({
    priority: 0,
    sourceSectionIds: ['my-tech-blog-jp', 'company-tech-blog', 'karaage-ai-news'],
  });
  expect(definitions.find((item) => item.id === 'zenn-dedup')?.priority).toBe(
    definitions.find((item) => item.id === 'qiita-dedup')?.priority,
  );
  expect(definitions.filter((item) => item.id !== 'my-tech-blog-jp-dedup').every((item) => item.priority === 1)).toBe(
    true,
  );
  for (const definition of definitions) {
    expect(FEED_SECTION_LIST.some((section) => section.id === definition.id)).toBe(false);
    expect(DISPLAY_SECTION_LIST.find((section) => section.id === definition.id)?.feedDirectory).toBe(
      'deduplicated-feeds',
    );
  }
});

it.each([
  { id: '../path' },
  { id: 'jp' },
  { id: 'translated' },
  { title: '' },
  { sourceSectionIds: ['absent'] },
  { sourceSectionIds: [] },
  { sourceSectionIds: ['jp', 'jp'] },
  { priority: -1 },
  { priority: 0.5 },
])('不正な定義を拒否する: %o', (override) => {
  const definition = { id: 'dedup', title: '統合', sourceSectionIds: ['jp'], priority: 0, ...override };
  expect(() => parseDeduplicatedFeeds([definition], ['jp'], ['translated'])).toThrow();
});

it('同じ入力カテゴリを複数の配信先に指定できない', () => {
  const first = { id: 'first', title: '統合', sourceSectionIds: ['jp'], priority: 0 };
  expect(() => parseDeduplicatedFeeds([first, { ...first, id: 'second' }], ['jp'], [])).toThrow();
});
