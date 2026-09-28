import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { minifyCssFilter } from './eleventy-utils';

interface StylesheetAsset {
  css: string;
  path: string;
}

/** CSSの内容に応じた購読ページ共通のアセットURLを返す。 */
export const createStylesheetAsset = (source: string): StylesheetAsset => {
  const css = minifyCssFilter(source);
  const version = createHash('sha256').update(css).digest('hex').slice(0, 16);
  return { css, path: `styles/bundle.css?v=${version}` };
};

const styleSources = ['vendor/reset.css', 'vendor/base.css', 'main.css'].map((file) =>
  readFileSync(new URL(`../site/_includes/styles/${file}`, import.meta.url), 'utf-8'),
);

/** 配信用CSSとHTMLの参照URLは同じ内容から決まる。 */
export const siteStylesheet = createStylesheetAsset(styleSources.join('\n'));
