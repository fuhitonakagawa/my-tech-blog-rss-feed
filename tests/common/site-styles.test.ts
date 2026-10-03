import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { createStylesheetAsset, siteStylesheet } from '../../src/common/site-styles';
import { renderTopSection } from '../../src/site/_includes/components/top-section';
import { render } from '../../src/site/_includes/layouts/main.11ty';

describe('共通CSSのキャッシュ更新', () => {
  it('ライトテーマ固定のページで購読・一覧・GitHubへの操作を保持する', () => {
    const page = { url: '/rss/aws-jp/' };
    const rssUrl = 'https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/aws-jp/feeds/rss.xml';
    const html = render({ content: renderTopSection(page, rssUrl), pageTitle: 'AWS', page });
    const $ = load(html);
    expect($('meta[name="color-scheme"]').attr('content')).toBe('only light');
    expect($('meta[name="theme-color"]')).toHaveLength(1);
    expect($('meta[name="theme-color"]').attr('media')).toBeUndefined();
    expect($('.ui-section-header button')).toHaveLength(1);
    expect($('.ui-feed-list-button')).toHaveLength(1);
    expect($('.ui-section-header a[aria-label="GitHub"]').attr('href')).toBe(
      'https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/',
    );
    expect($('img[alt="Slackのロゴ"]').attr('src')).toBe('../../images/slack-mark.png');
    expect(
      $('.feed-url-copy-button')
        .toArray()
        .map((node) => $(node).attr('data-copy-value')),
    ).toEqual([`/feed ${rssUrl}`, rssUrl]);
    expect(html).not.toMatch(/localStorage|matchMedia|data-theme/);
    expect(siteStylesheet.css).not.toMatch(/prefers-color-scheme|data-theme/);
  });

  it('CSSが同じならURLを維持し、内容が変われば別URLにする', () => {
    const initial = createStylesheetAsset('a { color: red; }');
    expect(createStylesheetAsset('a { color: red; }')).toEqual(initial);
    expect(createStylesheetAsset('a { color: blue; }').path).not.toBe(initial.path);
  });

  it.each(['/', '/statistics/daily/', '/rss/zenn/'])('各階層で同じ版のCSSを先読み・適用する: %s', (url) => {
    const page = load(render({ content: '', pageTitle: '検証', page: { url } }));
    const stylesheetUrl = page('link[rel="stylesheet"]').attr('href');
    expect(stylesheetUrl).toBeDefined();
    expect(page('link[rel="preload"][as="style"]').attr('href')).toBe(stylesheetUrl);
    expect(new URL(stylesheetUrl ?? '', `https://example.com/project${url}`).href).toBe(
      `https://example.com/project/${siteStylesheet.path}`,
    );
    expect(siteStylesheet.css).toContain('.ui-statistics-category');
  });
});
