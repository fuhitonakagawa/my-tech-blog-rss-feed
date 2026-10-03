import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import constants, { sectionFeedUrls } from '../../../common/constants';
import { relativeUrlFilter } from '../../../common/eleventy-utils';
import { statisticsConfig, statisticsFeedUrls } from '../../../feed/statistics/config';
import { DEDUPLICATED_FEED_DEFINITION_LIST } from '../../../resources/deduplicated-feed-list';
import { DISPLAY_SECTION_LIST } from '../../../resources/display-section-list';
import { FEED_SECTION_LIST, type FeedInfo } from '../../../resources/feed-info-list';
import { sectionPathId } from '../../../resources/section-paths';
import { TRANSLATED_FEED_DEFINITION_LIST } from '../../../resources/translated-feed-list';
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

/** 登録フィード一覧を開くヘッダーボタン。 */
export const renderFeedListButton = (): string => {
  return `<button type="button" class="ui-feed-list-button" aria-label="登録フィード一覧を開く" aria-haspopup="dialog" aria-expanded="false" aria-controls="feed-list-dialog">
        <svg class="ui-feed-list-button__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M9 6h12M9 12h12M9 18h12"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/>
        </svg>
        <span>フィード一覧</span>
    </button>`;
};

/** 取得元の名前・RSS URL・生成状態を同じ行の中に表示する。 */
const renderSourceFeed = (
  feedInfo: FeedInfo,
  statuses: ReadonlyMap<string, GeneratedFeedDisplayStatus>,
): string => `<li class="ui-feed-list-dialog__feed">
    <div class="ui-feed-list-dialog__feed-heading">
        <a class="ui-feed-list-dialog__feed-label" href="${escapeHtml(feedInfo.pageUrl ?? feedInfo.url)}">${escapeHtml(feedInfo.label)}</a>
        ${renderGeneratedFeedStatus(feedInfo, statuses)}
    </div>
    <a class="ui-feed-list-dialog__feed-url" href="${escapeHtml(feedInfo.url)}">${escapeHtml(feedInfo.url)}</a>
</li>`;

/** 派生フィードの集約元・翻訳元のカテゴリへ案内する。 */
const renderSourceSections = (ids: string[], relativeUrl: string): string =>
  `<ul class="ui-feed-list-dialog__sources">${ids
    .map((id) => {
      const title = FEED_SECTION_LIST.find((section) => section.id === id)?.title ?? id;
      return `<li><a href="${relativeUrl}${constants.sectionRootPath}/${escapeHtml(sectionPathId(id))}/">${escapeHtml(title)}</a></li>`;
    })
    .join('')}</ul>`;

interface FeedListCategory {
  id: string;
  title: string;
  pagePath: string;
  rssUrl: string;
  meta: string;
  sourceTitle: string;
  sources: string;
}

/** カテゴリの購読先と取得元を分け、現在のカテゴリだけ初期表示で展開する。 */
const renderCategory = (category: FeedListCategory, page: EleventyPage): string => {
  const relativeUrl = escapeHtml(relativeUrlFilter(page.url));
  const current = page.url === `/${category.pagePath}`;
  return `<details class="ui-feed-list-dialog__section" id="feed-list-section-${escapeHtml(category.id)}"${current ? ' open' : ''}>
    <summary class="ui-feed-list-dialog__summary">
        <span class="ui-feed-list-dialog__section-title">${escapeHtml(category.title)}</span>
        <span class="ui-feed-list-dialog__meta">${escapeHtml(category.meta)}</span>
    </summary>
    <div class="ui-feed-list-dialog__section-content">
        <div class="ui-feed-list-dialog__subscription">
            <a class="ui-feed-list-dialog__page-link" href="${relativeUrl}${escapeHtml(category.pagePath)}">カテゴリページ</a>
            <span class="ui-feed-list-dialog__source-title">購読RSS</span>
            <a class="ui-feed-list-dialog__feed-url" href="${escapeHtml(category.rssUrl)}">${escapeHtml(category.rssUrl)}</a>
        </div>
        <p class="ui-feed-list-dialog__source-title">${escapeHtml(category.sourceTitle)}</p>
        ${category.sources}
    </div>
</details>`;
};

/** 種別に応じた取得元を、カテゴリ共通の表示形式で返す。 */
const createCategory = (
  section: (typeof DISPLAY_SECTION_LIST)[number],
  relativeUrl: string,
  statuses: ReadonlyMap<string, GeneratedFeedDisplayStatus>,
): FeedListCategory => {
  const base = {
    id: section.id,
    title: section.title,
    pagePath: `${constants.sectionRootPath}/${sectionPathId(section.id)}/`,
    rssUrl: sectionFeedUrls(section.id).rss,
  };
  const deduplicated = DEDUPLICATED_FEED_DEFINITION_LIST.find(({ id }) => id === section.id);
  if (deduplicated) {
    return {
      ...base,
      meta: `重複除外 · ${deduplicated.sourceSectionIds.length}カテゴリ`,
      sourceTitle: '集約元カテゴリ',
      sources: renderSourceSections(deduplicated.sourceSectionIds, relativeUrl),
    };
  }
  const translated = TRANSLATED_FEED_DEFINITION_LIST.find(({ id }) => id === section.id);
  if (translated) {
    return {
      ...base,
      meta: '日本語訳',
      sourceTitle: `${translated.sourceLanguage === 'zh' ? '中国語' : '英語'}記事の翻訳元カテゴリ`,
      sources: renderSourceSections([translated.sourceSectionId], relativeUrl),
    };
  }
  const feeds = FEED_SECTION_LIST.find(({ id }) => id === section.id)?.feedInfoList ?? [];
  const available = feeds.filter((feed) => isAvailableFeed(feed, statuses));
  return {
    ...base,
    meta: `取得元 ${available.length}件`,
    sourceTitle: '取得元RSS',
    sources: available.length
      ? `<ul class="ui-feed-list-dialog__feeds">${available.map((feed) => renderSourceFeed(feed, statuses)).join('')}</ul>`
      : '<p class="ui-feed-list-dialog__empty">公開可能な取得元RSSはありません。</p>',
  };
};

/** 配信元・テーマの表示順で、カテゴリと取得元を一覧するモーダル。 */
export const renderFeedListDialog = (
  page: EleventyPage,
  generatedFeedStatuses: ReadonlyMap<string, GeneratedFeedDisplayStatus> = loadGeneratedFeedStatuses(),
): string => {
  const relativeUrl = escapeHtml(relativeUrlFilter(page.url));
  const categories = DISPLAY_SECTION_LIST.map((section) =>
    renderCategory(createCategory(section, relativeUrl, generatedFeedStatuses), page),
  ).join('');
  const statistics = renderCategory(
    {
      id: 'statistics',
      title: statisticsConfig.title,
      pagePath: statisticsConfig.pagePath,
      rssUrl: statisticsFeedUrls.rss,
      meta: '日次集計',
      sourceTitle: '集計対象',
      sources: '<p class="ui-feed-list-dialog__empty">通常・日本語訳・重複除外カテゴリの記事数</p>',
    },
    page,
  );

  return `<dialog id="feed-list-dialog" class="ui-feed-list-dialog" aria-labelledby="feed-list-dialog-title" aria-describedby="feed-list-dialog-description">
    <div class="ui-feed-list-dialog__panel">
        <div class="ui-feed-list-dialog__header">
            <div>
                <h2 id="feed-list-dialog-title" class="ui-feed-list-dialog__title">登録フィード一覧</h2>
                <p id="feed-list-dialog-description" class="ui-feed-list-dialog__description">カテゴリを開くと、購読RSSと取得元を確認できます。</p>
            </div>
            <button type="button" class="ui-feed-list-dialog__close" aria-label="登録フィード一覧を閉じる" autofocus>×</button>
        </div>
        <div class="ui-feed-list-dialog__body">${categories}${statistics}</div>
    </div>
</dialog>`;
};
