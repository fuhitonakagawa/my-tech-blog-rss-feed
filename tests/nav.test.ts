import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { DISPLAY_SECTION_LIST } from '../src/resources/display-section-list';
import { sectionPathId } from '../src/resources/section-paths';
import { renderNav } from '../src/site/_includes/components/nav';

describe('renderNav', () => {
  it('全カテゴリの購読ページを種別ごとに保持し、選択中のページを示す', () => {
    const $ = load(renderNav({ url: '/rss/qiita-dedup/' }));
    expect($('details, input')).toHaveLength(0);
    expect($('.ui-category-heading__current').text()).toContain('Qiita dedup');
    expect($('[aria-current="page"]')).toHaveLength(1);
    expect($('[aria-current="page"]').attr('href')).toBe('../../rss/qiita-dedup/');
    expect($('.ui-category-group')).toHaveLength(3);
    const targets = $('.ui-category-links a')
      .toArray()
      .map((node) => $(node).attr('href'));
    expect(new Set(targets).size).toBe(DISPLAY_SECTION_LIST.length);
    for (const section of DISPLAY_SECTION_LIST) expect(targets).toContain(`../../rss/${sectionPathId(section.id)}/`);
    expect($('.ui-category-scroll').attr('tabindex')).toBe('0');
    expect($('[hidden]')).toHaveLength(0);
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
