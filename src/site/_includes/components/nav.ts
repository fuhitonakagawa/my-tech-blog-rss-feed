import constants from '../../../common/constants';
import { relativeUrlFilter } from '../../../common/eleventy-utils';
import { statisticsConfig } from '../../../feed/statistics/config';
import { DISPLAY_SECTION_LIST } from '../../../resources/display-section-list';
import { sectionPathId } from '../../../resources/section-paths';
import { escapeHtml } from './html-utils';
import type { EleventyPage } from './types';

/** 全カテゴリを常時表示し、記事とは独立して縦にスクロールできるナビゲーション。 */
export const renderNav = (page: EleventyPage): string => {
  const relativeUrl = escapeHtml(relativeUrlFilter(page.url));
  const link = (title: string, target: string): string => {
    const active = page.url === `/${target}`;
    return `<a class='ui-section-nav__link${active ? ' ui-section-nav__link--active' : ''}'${active ? " aria-current='page'" : ''} href='${relativeUrl}${escapeHtml(target)}'>${escapeHtml(title)}</a>`;
  };
  const current = DISPLAY_SECTION_LIST.find(
    (section) => page.url === `/${constants.sectionRootPath}/${sectionPathId(section.id)}/`,
  );
  const currentTitle =
    current?.title ??
    (page.url === '/' ? 'ALL' : page.url === `/${statisticsConfig.pagePath}` ? statisticsConfig.title : 'カテゴリ一覧');
  const groups = [
    { directory: 'deduplicated-feeds', title: '重複除外（dedup）' },
    { directory: 'translated-feeds', title: '日本語翻訳' },
    { directory: 'section-feeds', title: 'カテゴリ別' },
  ];
  const sections = groups
    .map(
      (group) => `<section class='ui-category-group' aria-labelledby='category-${group.directory}'>
    <p class='ui-category-group__title' id='category-${group.directory}'>${group.title}</p>
    <ul class='ui-category-links'>${DISPLAY_SECTION_LIST.filter((section) => section.feedDirectory === group.directory)
      .map((section) => `<li>${link(section.title, `${constants.sectionRootPath}/${sectionPathId(section.id)}/`)}</li>`)
      .join('')}</ul>
  </section>`,
    )
    .join('');

  return `<nav class='ui-nav' aria-label='カテゴリ'>
    <div class='ui-category-heading'>
      <p class='ui-category-heading__title'>カテゴリ一覧</p>
      <p class='ui-category-heading__current'>現在：${escapeHtml(currentTitle)}</p>
    </div>
    <div class='ui-category-scroll' tabindex='0' role='region' aria-label='カテゴリ一覧を縦スクロール'>
      <div class='ui-category-shortcuts'>${link('ALL', '')}${link(statisticsConfig.title, statisticsConfig.pagePath)}</div>
      ${sections}
    </div>
</nav>`;
};
