import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGeneratedFeedAdapter } from '../../../src/feed/generated/adapter-registry';
import type { GeneratedFeedItem } from '../../../src/feed/generated/types';
import { logger } from '../../../src/feed/logger';
import { FEED_INFO_LIST } from '../../../src/resources/feed-info-list';
import { GENERATED_FEED_DEFINITION_MAP } from '../../../src/resources/generated-feed-list';

const definition = GENERATED_FEED_DEFINITION_MAP.get('anthropic-news');
if (!definition) {
  throw new Error('Anthropic Newsroomの生成フィード定義がありません');
}
const extract = (html: string): GeneratedFeedItem[] => getGeneratedFeedAdapter('anthropic-news')(definition, html);

/** 通常一覧のタイトル・URL・公開日を含む記事HTMLを返す */
const listArticle = (href: string, date: string, title = '記事タイトル'): string => `
  <li><a class="PublicationList-module-scss-module__hash__listItem" href="${href}">
    <div><time>${date}</time><span class="PublicationList-module-scss-module__hash__subject">Research</span></div>
    <span class="PublicationList-module-scss-module__hash__title">${title}</span>
  </a></li>
`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Anthropic Newsroomの抽出', () => {
  it('注目記事と通常一覧を扱い、URL重複時は先頭の記事を保持する', () => {
    const items = extract(`
      <nav>${listArticle('/news/navigation', 'Sep 1, 2026')}</nav>
      <main>
        <a class="FeaturedGrid-module-scss-module__newHash__content" href="/featured?utm_source=news">
          <h2> 注目記事\n タイトル </h2>
          <div class="FeaturedGrid-module-scss-module__newHash__meta"><span>Announcements</span><time>Sep 22, 2026</time></div>
          <p>記事の概要</p>
        </a>
        <a class="FeaturedGrid-module-scss-module__newHash__sideLink" href="https://www.anthropic.com/features/story">
          <h4>サイド記事</h4><time>Sep 21, 2026</time>
        </a>
        <ul>
          ${listArticle('/featured', 'Sep 22, 2026', '重複記事')}
          ${listArticle('/news/research?id=1&utm_campaign=news', 'Feb 29, 2024')}
        </ul>
      </main>
    `);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      id: 'https://www.anthropic.com/featured',
      url: 'https://www.anthropic.com/featured',
      title: '注目記事 タイトル',
      publishedAt: '2026-09-22T00:00:00.000Z',
      summary: '記事の概要',
      creator: '',
      categories: ['Announcements'],
    });
    expect(items[1]).toMatchObject({ title: 'サイド記事', categories: [], summary: '' });
    expect(items[2]).toMatchObject({
      url: 'https://www.anthropic.com/news/research?id=1',
      publishedAt: '2024-02-29T00:00:00.000Z',
      categories: ['Research'],
    });
  });

  it.each([
    ['/news/invalid', 'Feb 29, 2025', '記事'],
    ['/news/invalid', 'Apr 31, 2026', '記事'],
    ['/news/invalid', 'Foo 1, 2026', '記事'],
    ['/news/invalid', '', '記事'],
    ['/news/invalid', 'Sep 22, 2026', ''],
    ['', 'Sep 22, 2026', '記事'],
    ['javascript:alert(1)', 'Sep 22, 2026', '記事'],
    ['http://127.0.0.1/private', 'Sep 22, 2026', '記事'],
    ['https://example.com/unrelated', 'Sep 22, 2026', '記事'],
    ['https://user:password@www.anthropic.com/private', 'Sep 22, 2026', '記事'],
    ['https://www.anthropic.com/private?token=secret', 'Sep 22, 2026', '記事'],
  ])('不正記事を除外し有効記事を保持する: %s %s %s', (href, date, title) => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const items = extract(`<main><ul>
      ${listArticle(href, date, title)}
      ${listArticle('/news/valid', 'Sep 23, 2026')}
    </ul></main>`);
    expect(items.map((item) => item.url)).toEqual(['https://www.anthropic.com/news/valid']);
  });

  it.each(['<main></main>', `<main>${listArticle('/news/invalid', 'not a date')}</main>`])(
    '有効記事がない場合は生成元を異常として扱う',
    (html) => {
      vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      expect(() => extract(html)).toThrow('有効な記事を取得できません');
    },
  );

  it('AIセクションだけに所属する', () => {
    const feeds = FEED_INFO_LIST.filter((feed) => feed.input.kind === 'generated' && feed.input.id === definition.id);
    expect(feeds).toHaveLength(1);
    expect(feeds[0]).toMatchObject({ label: 'Anthropic Newsroom', sectionId: 'ai', pageUrl: definition.pageUrl });
  });
});
