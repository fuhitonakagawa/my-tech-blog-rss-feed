import { describe, expect, it } from 'vitest';
import { renderNav } from '../src/site/_includes/components/nav';

describe('renderNav', () => {
  it('ナビゲーションにはカテゴリリンクだけを表示する', () => {
    const html = renderNav({ url: '/rss/speakerdeck/' });

    expect(html).not.toContain('人気フィード');
    expect(html).not.toContain("href='../../hot/'");
    expect(html).not.toContain('ブログ一覧');
    expect(html).not.toContain("href='../../blogs/'");
    expect(html).toContain('Speaker Deck');
  });
});
