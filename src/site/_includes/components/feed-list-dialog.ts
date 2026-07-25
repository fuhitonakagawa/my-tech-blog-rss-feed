import constants from '../../../common/constants';
import { relativeUrlFilter } from '../../../common/eleventy-utils';
import { FEED_SECTION_LIST } from '../../../resources/feed-info-list';
import { escapeHtml } from './html-utils';
import type { EleventyPage } from './types';

/**
 * 登録フィード一覧を開くヘッダーボタン。
 */
export const renderFeedListButton = (): string => {
  return `<button type="button" class="ui-feed-list-button" aria-label="登録フィード一覧を開く" aria-haspopup="dialog" aria-expanded="false" aria-controls="feed-list-dialog">
        <span class="ui-feed-list-button__icon" aria-hidden="true">☰</span>
    </button>`;
};

/**
 * セクションごとに登録フィードを一覧するモーダル。
 */
export const renderFeedListDialog = (page: EleventyPage): string => {
  const relativeUrl = escapeHtml(relativeUrlFilter(page.url));

  const sectionGroups = FEED_SECTION_LIST.map((section) => {
    const sectionPath = `${constants.sectionRootPath}/${section.id}/`;
    const feedItems = section.feedInfoList
      .map((feedInfo) => {
        return `<li class="ui-feed-list-dialog__feed">
                    <a class="ui-feed-list-dialog__feed-label" href="${escapeHtml(feedInfo.url)}">${escapeHtml(feedInfo.label)}</a>
                    <a class="ui-feed-list-dialog__feed-url" href="${escapeHtml(feedInfo.url)}">${escapeHtml(feedInfo.url)}</a>
                </li>`;
      })
      .join('\n');

    return `<section class="ui-feed-list-dialog__section" aria-labelledby="feed-list-section-${escapeHtml(section.id)}">
                <h3 id="feed-list-section-${escapeHtml(section.id)}" class="ui-feed-list-dialog__section-title">
                    <a href="${relativeUrl}${escapeHtml(sectionPath)}">${escapeHtml(section.title)}</a>
                </h3>
                <ul class="ui-feed-list-dialog__feeds">
                    ${feedItems}
                </ul>
            </section>`;
  }).join('\n');

  return `<div id="feed-list-dialog" class="ui-feed-list-dialog" role="dialog" aria-modal="true" aria-labelledby="feed-list-dialog-title" hidden>
        <div class="ui-feed-list-dialog__backdrop" data-feed-list-dialog-close></div>
        <div class="ui-feed-list-dialog__panel" tabindex="-1">
            <div class="ui-feed-list-dialog__header">
                <h2 id="feed-list-dialog-title" class="ui-feed-list-dialog__title">登録フィード一覧</h2>
                <button type="button" class="ui-feed-list-dialog__close" aria-label="登録フィード一覧を閉じる" data-feed-list-dialog-close>×</button>
            </div>
            <div class="ui-feed-list-dialog__body">
                ${sectionGroups}
            </div>
        </div>
    </div>`;
};
