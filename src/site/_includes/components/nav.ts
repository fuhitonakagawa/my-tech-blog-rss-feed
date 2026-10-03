import constants from '../../../common/constants';
import { relativeUrlFilter } from '../../../common/eleventy-utils';
import { statisticsConfig } from '../../../feed/statistics/config';
import { DEDUPLICATED_FEED_DEFINITION_LIST } from '../../../resources/deduplicated-feed-list';
import { DISPLAY_SECTION_LIST } from '../../../resources/display-section-list';
import { sectionPathId } from '../../../resources/section-paths';
import { TRANSLATED_FEED_DEFINITION_LIST } from '../../../resources/translated-feed-list';
import { escapeHtml } from './html-utils';
import type { EleventyPage } from './types';

/** 集約元・翻訳元を親カテゴリの下に常時表示するための所属。 */
const sourceSections = new Map<string, string[]>([
  ...DEDUPLICATED_FEED_DEFINITION_LIST.map(({ id, sourceSectionIds }): [string, string[]] => [id, sourceSectionIds]),
  ...TRANSLATED_FEED_DEFINITION_LIST.map(({ id, sourceSectionId }): [string, string[]] => [id, [sourceSectionId]]),
]);
const childSectionIds = new Set([...sourceSections.values()].flat());

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
  const sections = DISPLAY_SECTION_LIST.filter((section) => !childSectionIds.has(section.id))
    .map((section) => {
      const children = DISPLAY_SECTION_LIST.filter((child) => sourceSections.get(section.id)?.includes(child.id));
      const childLinks = children
        .map((child) => `<li>${link(child.title, `${constants.sectionRootPath}/${sectionPathId(child.id)}/`)}</li>`)
        .join('');
      return `<li${children.length ? " class='ui-category-parent'" : ''}>
        ${link(section.title, `${constants.sectionRootPath}/${sectionPathId(section.id)}/`)}
        ${children.length ? `<ul class='ui-category-children'>${childLinks}</ul>` : ''}
      </li>`;
    })
    .join('');

  return `<nav class='ui-nav' aria-label='カテゴリ'>
    <div class='ui-category-heading'>
      <p class='ui-category-heading__title'>カテゴリ一覧</p>
      <p class='ui-category-heading__current'>現在：${escapeHtml(currentTitle)}</p>
    </div>
    <div class='ui-category-scroll' tabindex='0' role='region' aria-label='カテゴリ一覧を縦スクロール'>
      <div class='ui-category-shortcuts'>${link('ALL', '')}${link(statisticsConfig.title, statisticsConfig.pagePath)}</div>
      <ul class='ui-category-links'>${sections}</ul>
    </div>
</nav>`;
};
