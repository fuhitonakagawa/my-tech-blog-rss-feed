import constants from '../../../common/constants';
import { relativeUrlFilter } from '../../../common/eleventy-utils';
import { statisticsConfig } from '../../../feed/statistics/config';
import { DISPLAY_SECTION_LIST } from '../../../resources/display-section-list';
import { escapeHtml } from './html-utils';
import type { EleventyPage } from './types';

/**
 * partials/nav.njk 相当のナビゲーション。
 */
export const renderNav = (page: EleventyPage): string => {
  const relativeUrl = escapeHtml(relativeUrlFilter(page.url));
  const feedActive = ['/'].includes(page.url) ? 'ui-section-nav__link--active' : '';

  const sectionLinks = DISPLAY_SECTION_LIST.map((section) => {
    const sectionPath = `${constants.sectionRootPath}/${section.id}/`;
    const sectionActive = page.url === `/${sectionPath}` ? 'ui-section-nav__link--active' : '';
    return `<a class='ui-section-nav__link ${sectionActive}' href='${relativeUrl}${escapeHtml(sectionPath)}'>${escapeHtml(section.title)}</a>`;
  }).join('\n            ');

  return `<nav class='ui-nav'>
    <div class='ui-layout-container'>
        <div class='ui-section-nav__layout ui-layout-flex'>
            <a class='ui-section-nav__link ${feedActive}' href='${relativeUrl}'>ALL</a>
            ${sectionLinks}
            <a class='ui-section-nav__link ${page.url === `/${statisticsConfig.pagePath}` ? 'ui-section-nav__link--active' : ''}' href='${relativeUrl}${statisticsConfig.pagePath}'>${escapeHtml(statisticsConfig.title)}</a>
        </div>
    </div>
</nav>`;
};
