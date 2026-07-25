import { describe, expect, it } from 'vitest';
import { renderNav } from '../src/site/_includes/components/nav';

describe('renderNav', () => {
  it('人気フィードへのリンクを表示しない', () => {
    const html = renderNav({ url: '/rss/speakerdeck/' });

    expect(html).not.toContain('人気フィード');
    expect(html).not.toContain("href='../../hot/'");
  });
});
