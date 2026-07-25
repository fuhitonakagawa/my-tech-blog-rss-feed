import { describe, expect, it } from 'vitest';
import { renderTopSection } from '../src/site/_includes/components/top-section';

describe('renderTopSection', () => {
  it('コピー用URLを折り返し可能なテキストとして表示する', () => {
    const rssFeedUrl = 'https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/publickey/feeds/rss.xml';

    const html = renderTopSection({ url: '/rss/publickey/' }, rssFeedUrl);

    expect(html).toContain(`<code id='feed-url-slack' class="ui-component-copy-value">/feed ${rssFeedUrl}</code>`);
    expect(html).toContain(`<code id='feed-url-rss' class="ui-component-copy-value">${rssFeedUrl}</code>`);
    expect(html).toContain(`data-copy-value="/feed ${rssFeedUrl}"`);
    expect(html).toContain(`data-copy-value="${rssFeedUrl}"`);
    expect(html).not.toContain('ui-component-input');
  });
});
