import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractGeneratedFeedItems } from '../../../src/feed/generated/extractor';
import type { GeneratedFeedItem } from '../../../src/feed/generated/types';
import { logger } from '../../../src/feed/logger';
import { FEED_INFO_LIST } from '../../../src/resources/feed-info-list';
import { GENERATED_FEED_DEFINITION_MAP } from '../../../src/resources/generated-feed-list';

const definition = GENERATED_FEED_DEFINITION_MAP.get('claude-announcements');
if (!definition) {
  throw new Error('Claude Product announcementsの生成フィード定義がありません');
}
const extract = (html: string): GeneratedFeedItem[] => extractGeneratedFeedItems(definition, html);

/** カード内の表示用リンク・記事情報・カテゴリを含むHTMLを返す */
const article = (date: string, href = '/blog/article?id=1&utm_source=news', title = ' 記事\nタイトル '): string => `
  <div class="blog_cms_item w-dyn-item">
    <div class="card_blog_wrap">
      <a href="#">表示用リンク</a>
      <div fs-list-field="heading">${title}</div>
      <div fs-list-field="date">${date}</div>
      <div class="w-dyn-item"><div fs-list-field="category">Product announcements</div></div>
      <a fs-list-element="item-link" href="${href}"></a>
    </div>
  </div>
`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Claude Product announcementsの生成フィード', () => {
  it('グリッドの記事だけを抽出しリスト表示やナビゲーションの重複を含めない', () => {
    const card = article('September 25, 2026');
    const items = extract(`
      <nav><div class="blog_cms_grid">${card}</div></nav>
      <main>
        <div class="blog_cms_grid">${card}</div>
        <div class="blog_cms_list">${card}</div>
      </main>
    `);
    expect(items).toEqual([
      {
        id: 'https://claude.com/blog/article?id=1',
        url: 'https://claude.com/blog/article?id=1',
        title: '記事タイトル',
        publishedAt: '2026-09-25T00:00:00.000Z',
        summary: '',
        creator: '',
        categories: ['Product announcements'],
      },
    ]);
  });

  it.each([
    ['', '/blog/article', '記事'],
    ['February 29, 2025', '/blog/article', '記事'],
    ['April 31, 2026', '/blog/article', '記事'],
    ['Septembruary 1, 2026', '/blog/article', '記事'],
    ['September 25, 2026', '', '記事'],
    ['September 25, 2026', '/blog/article', ''],
    ['September 25, 2026', 'javascript:alert(1)', '記事'],
    ['September 25, 2026', 'https://user:password@claude.com/blog/article', '記事'],
    ['September 25, 2026', 'https://claude.com/blog/article?token=secret', '記事'],
  ])('不正な記事を除外する: %s %s %s', (date, href, title) => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(logger, 'trace').mockImplementation(() => undefined);
    const items = extract(`<main><div class="blog_cms_grid">
      ${article(date, href, title)}
      ${article('February 29, 2024', '/blog/valid')}
    </div></main>`);
    expect(items.map((item) => item.url)).toEqual(['https://claude.com/blog/valid']);
  });

  it('記事一覧が存在しない場合は生成元を異常として扱う', () => {
    expect(() => extract('<main></main>')).toThrow('記事を取得できません');
  });

  it('AIセクションだけに所属する', () => {
    const feeds = FEED_INFO_LIST.filter((feed) => feed.input.kind === 'generated' && feed.input.id === definition.id);
    expect(feeds).toHaveLength(1);
    expect(feeds[0]).toMatchObject({
      label: 'Claude Product announcements',
      sectionId: 'my-tech-blog-ai',
      pageUrl: definition.pageUrl,
    });
  });
});
