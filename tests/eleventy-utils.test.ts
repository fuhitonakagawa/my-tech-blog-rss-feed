import { describe, expect, it } from 'vitest';
import { imageIconShortcode, minifyCssFilter, relativeUrlFilter } from '../src/common/eleventy-utils';

describe('relativeUrlFilter', () => {
  it('ルート（/）は ./ を返す', () => {
    expect(relativeUrlFilter('/')).toEqual('./');
  });

  it('1 階層下（/hot/）は ../ を返す', () => {
    expect(relativeUrlFilter('/hot/')).toEqual('../');
  });

  it('2 階層下（/blogs/<hash>/）は ../../ を返す', () => {
    expect(relativeUrlFilter('/blogs/abc123/')).toEqual('../../');
  });
});

describe('minifyCssFilter', () => {
  it('余分な空白を除去して CSS を圧縮する', () => {
    expect(minifyCssFilter('a {  color:  red ;  }')).toEqual('a{color:red}');
  });

  it('空文字は空文字を返す', () => {
    expect(minifyCssFilter('')).toEqual('');
  });
});

describe('imageIconShortcode', () => {
  it('data URL の属性値を HTML エスケープする', async () => {
    const dataUrl =
      "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%3E%3Ctext%3Eicon%3C/text%3E%3C/svg%3E";

    await expect(imageIconShortcode(dataUrl, "ブログ's ファビコン", '', 'lazy')).resolves.toBe(
      "<img src='data:image/svg+xml,%3Csvg%20xmlns=&#39;http://www.w3.org/2000/svg&#39;%3E%3Ctext%3Eicon%3C/text%3E%3C/svg%3E' alt='ブログ&#39;s ファビコン' loading='lazy' width='16' height='16'>",
    );
  });
});
