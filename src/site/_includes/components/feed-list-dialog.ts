import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import constants from '../../../common/constants';
import { relativeUrlFilter } from '../../../common/eleventy-utils';
import { FEED_SECTION_LIST, type FeedInfo } from '../../../resources/feed-info-list';
import { escapeHtml } from './html-utils';
import type { EleventyPage } from './types';

const GENERATED_FEEDS_OUTPUT_DIR_PATH = fileURLToPath(new URL('../../feeds/generated/', import.meta.url));

export type GeneratedFeedDisplayStatus = 'ok' | 'stale';

/** RSSを公開できる生成フィードの状態を取得する */
const loadGeneratedFeedStatuses = (): Map<string, GeneratedFeedDisplayStatus> => {
  const statuses = new Map<string, GeneratedFeedDisplayStatus>();
  if (!fs.existsSync(GENERATED_FEEDS_OUTPUT_DIR_PATH)) {
    return statuses;
  }

  for (const generatedFeedId of fs.readdirSync(GENERATED_FEEDS_OUTPUT_DIR_PATH)) {
    const directoryPath = path.join(GENERATED_FEEDS_OUTPUT_DIR_PATH, generatedFeedId);
    const rssFilePath = path.join(directoryPath, 'rss.xml');
    const statusFilePath = path.join(directoryPath, 'status.json');
    if (!fs.existsSync(rssFilePath) || !fs.existsSync(statusFilePath)) {
      continue;
    }

    const status = JSON.parse(fs.readFileSync(statusFilePath, 'utf-8')) as Record<string, unknown>;
    if (status.state === 'ok' || status.state === 'stale') {
      statuses.set(generatedFeedId, status.state);
    }
  }

  return statuses;
};

/** 公開可能な登録フィードか判定する */
const isAvailableFeed = (
  feedInfo: FeedInfo,
  generatedFeedStatuses: ReadonlyMap<string, GeneratedFeedDisplayStatus>,
): boolean => {
  return feedInfo.input.kind === 'remote' || generatedFeedStatuses.has(feedInfo.input.id);
};

/** 生成フィードの状態表示を返す */
const renderGeneratedFeedStatus = (
  feedInfo: FeedInfo,
  generatedFeedStatuses: ReadonlyMap<string, GeneratedFeedDisplayStatus>,
): string => {
  if (feedInfo.input.kind !== 'generated') {
    return '';
  }

  const status = generatedFeedStatuses.get(feedInfo.input.id);
  const label = status === 'stale' ? '前回正常データを配信中' : '正常';
  return `<span class="ui-feed-list-dialog__feed-status" data-status="${status}">${label}</span>`;
};

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
export const renderFeedListDialog = (
  page: EleventyPage,
  generatedFeedStatuses: ReadonlyMap<string, GeneratedFeedDisplayStatus> = loadGeneratedFeedStatuses(),
): string => {
  const relativeUrl = escapeHtml(relativeUrlFilter(page.url));

  const sectionGroups = FEED_SECTION_LIST.map((section) => {
    const sectionPath = `${constants.sectionRootPath}/${section.id}/`;
    const feedItems = section.feedInfoList
      .filter((feedInfo) => isAvailableFeed(feedInfo, generatedFeedStatuses))
      .map((feedInfo) => {
        return `<li class="ui-feed-list-dialog__feed">
                    <div class="ui-feed-list-dialog__feed-heading">
                        <a class="ui-feed-list-dialog__feed-label" href="${escapeHtml(feedInfo.pageUrl ?? feedInfo.url)}">${escapeHtml(feedInfo.label)}</a>
                        ${renderGeneratedFeedStatus(feedInfo, generatedFeedStatuses)}
                    </div>
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
