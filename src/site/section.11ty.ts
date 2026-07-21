import constants, { sectionFeedUrls } from '../common/constants';
import { renderFeedItem } from './_includes/components/feed-item';
import { escapeHtml } from './_includes/components/html-utils';
import { renderNav } from './_includes/components/nav';
import { indexScript } from './_includes/components/scripts';
import { renderTopSection } from './_includes/components/top-section';
import { type EleventyPage, type FeedSectionPageData, SITE_PAGE_DATE } from './_includes/components/types';

interface SectionData {
  page: EleventyPage;
  section: FeedSectionPageData;
}

export const data = {
  layout: 'layouts/main.11ty.ts',
  date: SITE_PAGE_DATE,
  pagination: {
    data: 'sections',
    size: 1,
    alias: 'section',
    addAllPagesToCollections: true,
  },
  permalink: (data: SectionData) => `${constants.sectionRootPath}/${data.section.id}/`,
  eleventyComputed: {
    // エスケープはレイアウト側（main.11ty.ts）で行うため、ここでは生の文字列を渡す
    pageTitle: (data: SectionData) => `${data.section.title}｜${constants.siteTitle}`,
    lastUpdated: (data: SectionData) => data.section.lastModified,
    // レイアウトの alternate リンクをこのセクションのフィードに向ける
    feedDir: (data: SectionData) => `${constants.sectionRootPath}/${data.section.id}/feeds/`,
  },
};

export async function render(data: SectionData): Promise<string> {
  const { page, section } = data;

  const chunks: string[] = [];
  for (const [dateString, feedItems] of Object.entries(section.feedItemsChunks)) {
    const items = await Promise.all(
      feedItems.map((feedItem, index) => renderFeedItem(feedItem, page, index < 4 ? 'eager' : 'lazy')),
    );
    chunks.push(`<h3 class='ui-section-content__feed-date-heading'>${escapeHtml(dateString)}</h3>
            <div class="ui-section-content--feature ui-layout-grid ui-layout-grid-3 ui-container-feed">
                ${items.join('\n')}
            </div>`);
  }

  const feedItemsContent =
    chunks.length > 0 ? chunks.join('\n\n') : `<p class='ui-text-note'>直近1週間の更新はありません</p>`;

  return `${renderTopSection(page, sectionFeedUrls(section.id).rss)}

${renderNav(page)}

<section class="ui-section-content ui-section-feed">
    <div class="ui-layout-container">
        <h2 class='ui-typography-heading'>${escapeHtml(section.title)}の直近1週間の更新</h2>

        ${feedItemsContent}
    </div>
</section>

<script>
    ${indexScript}
</script>`;
}
