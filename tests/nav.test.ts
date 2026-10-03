import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { DEDUPLICATED_FEED_DEFINITION_LIST } from '../src/resources/deduplicated-feed-list';
import { DISPLAY_SECTION_LIST } from '../src/resources/display-section-list';
import { sectionPathId } from '../src/resources/section-paths';
import { TRANSLATED_FEED_DEFINITION_LIST } from '../src/resources/translated-feed-list';
import { renderNav } from '../src/site/_includes/components/nav';

describe('renderNav', () => {
  it('全カテゴリの購読ページを一度ずつ保持し、選択中のページを示す', () => {
    const $ = load(renderNav({ url: '/rss/qiita-dedup/' }));
    expect($('details, input, button, [role=tree], [aria-expanded]')).toHaveLength(0);
    expect($('.ui-category-heading__current').text()).toContain('Qiita dedup');
    expect($('[aria-current="page"]')).toHaveLength(1);
    expect($('[aria-current="page"]').attr('href')).toBe('../../rss/qiita-dedup/');
    expect($('.ui-category-group')).toHaveLength(0);
    const targets = $('.ui-category-links a')
      .toArray()
      .map((node) => $(node).attr('href'));
    expect(new Set(targets).size).toBe(DISPLAY_SECTION_LIST.length);
    expect(targets).toHaveLength(DISPLAY_SECTION_LIST.length);
    expect(targets.toSorted()).toEqual(
      DISPLAY_SECTION_LIST.map((section) => `../../rss/${sectionPathId(section.id)}/`).toSorted(),
    );
    expect($('.ui-category-scroll').attr('tabindex')).toBe('0');
    expect($('[hidden]')).toHaveLength(0);
  });

  it('集約・翻訳カテゴリの下に元カテゴリを枝分かれで表示する', () => {
    const $ = load(renderNav({ url: '/rss/company-tech-blog/' }));
    const parents = [
      ...DEDUPLICATED_FEED_DEFINITION_LIST.map(({ id, sourceSectionIds }) => ({ id, children: sourceSectionIds })),
      ...TRANSLATED_FEED_DEFINITION_LIST.map(({ id, sourceSectionId }) => ({ id, children: [sourceSectionId] })),
    ];
    for (const parent of parents) {
      const item = $(`.ui-category-links > li > a[href="../../rss/${sectionPathId(parent.id)}/"]`).parent();
      expect(item).toHaveLength(1);
      const children = item
        .find('.ui-category-children > li > a')
        .toArray()
        .map((node) => $(node).attr('href'));
      expect(children).toEqual(parent.children.map((id) => `../../rss/${sectionPathId(id)}/`));
    }
    expect($('[aria-current="page"]').text()).toBe('yamadashy企業テックブログ');
    expect($('[aria-current="page"]').closest('.ui-category-children')).toHaveLength(1);
    expect($('.ui-category-heading__current').text()).toContain('yamadashy企業テックブログ');
    expect(
      $('.ui-category-links > li > a')
        .toArray()
        .slice(0, 3)
        .map((node) => $(node).text()),
    ).toEqual(['企業TechBlog dedup', '個人ブログ', 'AI - Translated Japanese']);
  });

  it('ナビゲーションにはカテゴリリンクだけを表示する', () => {
    const html = renderNav({ url: '/rss/speakerdeck/' });

    expect(html).not.toContain('人気フィード');
    expect(html).not.toContain("href='../../hot/'");
    expect(html).not.toContain('ブログ一覧');
    expect(html).not.toContain("href='../../blogs/'");
    expect(html).toContain('Speaker Deck');
    expect(html).toContain("href='../../rss/ai-jp/'>AI - Translated Japanese</a>");
  });
});
