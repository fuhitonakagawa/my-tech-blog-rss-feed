import { load } from 'cheerio';
import { expect, it } from 'vitest';
import constants, { generatedFeedUrls, sectionFeedUrls } from '../../src/common/constants';
import { statisticsFeedUrls } from '../../src/feed/statistics/config';
import { DISPLAY_SECTION_LIST } from '../../src/resources/display-section-list';
import { GENERATED_FEED_DEFINITION_LIST } from '../../src/resources/generated-feed-list';
import {
  parseSectionPaths,
  sectionIdFromPath,
  sectionPathId,
  validateSectionPaths,
} from '../../src/resources/section-paths';
import { renderNav } from '../../src/site/_includes/components/nav';
import publicFeedPaths from '../fixtures/public-feed-paths.json' with { type: 'json' };

it('公開済みの全購読パスを保持し、管理用IDの変更で購読を途切れさせない', () => {
  const paths = new Set(
    [
      constants.feedUrls.rss,
      ...DISPLAY_SECTION_LIST.map((section) => sectionFeedUrls(section.id).rss),
      ...GENERATED_FEED_DEFINITION_LIST.map((definition) => generatedFeedUrls(definition.id).rss),
      statisticsFeedUrls.rss,
    ].map((url) => url.slice(constants.siteUrl.length)),
  );
  for (const path of publicFeedPaths) expect(paths.has(path), path).toBe(true);
});

it.each([
  ['my-tech-blog-ai', 'ai'],
  ['karaage-ai-news', 'ai-news'],
  ['my-tech-blog-ai-translated-jp', 'ai-jp'],
  ['my-tech-blog-jp-dedup', 'tech-blog-dedup'],
  ['it-media-dedup', 'itmedia-dedup'],
])('管理用ID %s から購読パス %s と履歴上の同一性を保持する', (id, path) => {
  expect(sectionPathId(id)).toBe(path);
  expect(sectionIdFromPath(path)).toBe(id);
  expect(sectionFeedUrls(id).rss).toBe(`${constants.siteUrl}rss/${path}/feeds/rss.xml`);
});

it('日次統計の購読先と現在のナビゲーションを保持する', () => {
  expect(statisticsFeedUrls.rss).toBe(`${constants.siteUrl}feeds/statistics/daily/rss.xml`);
  const nav = renderNav({ url: '/rss/ai/' });
  const $ = load(nav);
  expect($('a[aria-current="page"]').attr('href')).toBe('../../rss/ai/');
  expect($('a[aria-current="page"]').hasClass('ui-section-nav__link--active')).toBe(true);
  expect(nav).toContain("href='../../rss/ai-jp/'>AI - Translated Japanese</a>");
});

it.each([null, [], { valid: '../escape' }, { '../escape': 'valid' }, { one: 'same', two: 'same' }])(
  '不正な公開パスを拒否する: %o',
  (value) => {
    expect(() => parseSectionPaths(value)).toThrow();
  },
);

it('未定義の対応表と、明示しない公開パスとの衝突も拒否する', () => {
  expect(() => validateSectionPaths([])).toThrow('未定義');
  expect(() => validateSectionPaths([...DISPLAY_SECTION_LIST.map((section) => section.id), 'ai'])).toThrow('重複');
});
