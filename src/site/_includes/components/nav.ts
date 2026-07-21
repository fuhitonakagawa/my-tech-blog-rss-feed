import constants from '../../../common/constants';
import { relativeUrlFilter } from '../../../common/eleventy-utils';
import { FEED_SECTION_LIST } from '../../../resources/feed-info-list';
import { escapeHtml } from './html-utils';
import type { EleventyPage } from './types';

/**
 * partials/nav.njk 相当のナビゲーション。
 */
export const renderNav = (page: EleventyPage): string => {
  const relativeUrl = escapeHtml(relativeUrlFilter(page.url));
  const feedActive = ['/'].includes(page.url) ? 'ui-section-nav__link--active' : '';
  const hotActive = ['/hot/'].includes(page.url) ? 'ui-section-nav__link--active' : '';
  const blogsActive = ['/blogs/'].includes(page.url) ? 'ui-section-nav__link--active' : '';

  const sectionLinks = FEED_SECTION_LIST.map((section) => {
    const sectionPath = `${constants.sectionRootPath}/${section.id}/`;
    const sectionActive = page.url === `/${sectionPath}` ? 'ui-section-nav__link--active' : '';
    return `<a class='ui-section-nav__link ${sectionActive}' href='${relativeUrl}${escapeHtml(sectionPath)}'>${escapeHtml(section.title)}</a>`;
  }).join('\n            ');

  return `<nav class='ui-nav'>
    <div class='ui-layout-container'>
        <div class='ui-section-nav__layout ui-layout-flex'>
            <a class='ui-section-nav__link ${feedActive}' href='${relativeUrl}'>ALL</a>
            ${sectionLinks}
            <a class='ui-section-nav__link ${hotActive}' href='${relativeUrl}hot/'>人気フィード</a>
            <a class='ui-section-nav__link ${blogsActive}' href='${relativeUrl}blogs/'>ブログ一覧</a>
        </div>
    </div>
</nav>`;
};
