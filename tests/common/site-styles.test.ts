import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { createStylesheetAsset, siteStylesheet } from '../../src/common/site-styles';
import { render } from '../../src/site/_includes/layouts/main.11ty';

describe('共通CSSのキャッシュ更新', () => {
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
    expect(siteStylesheet.css).toContain('.ui-statistics-table');
  });
});
