import { relativeUrlFilter } from '../../../common/eleventy-utils';
import { escapeHtml } from './html-utils';
import type { EleventyPage } from './types';

/**
 * partials/top-section.njk 相当のトップセクション。
 * トップページ・セクションページ共通で、渡されたRSSフィードURLのコピーUIを表示する
 */
export const renderTopSection = (page: EleventyPage, rssFeedUrl: string): string => {
  const relativeUrl = escapeHtml(relativeUrlFilter(page.url));
  const escapedRssFeedUrl = escapeHtml(rssFeedUrl);
  const escapedSlackFeedCommand = escapeHtml(`/feed ${rssFeedUrl}`);

  return `<section class="ui-section-content ui-top-section">
    <div class="ui-layout-container">
        <div class="ui-layout-column-6 ui-layout-column-center">
            <p class="ui-text-intro">
                企業のテックブログの更新をまとめた<br>RSSフィードを配信しています<br>
            </p>
            <div class="ui-component-cta ui-layout-flex">
                <form class="ui-component-form ui-layout-grid">
                    <span class='ui-component-form__label'>
                        <img src='${relativeUrl}images/slack-mark.png' alt='Slackのロゴ' loading="eager" width='96' height='96'>
                    </span>
                    <code id='feed-url-slack' class="ui-component-copy-value">${escapedSlackFeedCommand}</code>
                    <button type="button" class="ui-component-button ui-component-button-medium ui-component-button-primary feed-url-copy-button" data-copy-value="${escapedSlackFeedCommand}" aria-label="Slack用フィードURLをコピー">コピー</button>
                </form>
                <p class="ui-text-note"><small>Slackに貼り付けると更新を受け取ることができます</small></p>
                <form class="ui-component-form ui-layout-grid">
                    <span class='ui-component-form__label'>
                        <span>RSS URL</span>
                    </span>
                    <code id='feed-url-rss' class="ui-component-copy-value">${escapedRssFeedUrl}</code>
                    <button type="button" class="ui-component-button ui-component-button-medium ui-component-button-primary feed-url-copy-button" data-copy-value="${escapedRssFeedUrl}" aria-label="RSS URLをコピー">コピー</button>
                </form>
            </div>
        </div>
    </div>
</section>`;
};
