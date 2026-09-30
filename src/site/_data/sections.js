import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';
import { DISPLAY_SECTION_LIST } from '../../resources/display-section-list';
import { sectionPathId } from '../../resources/section-paths';
import { dayjs } from './lib/dayjs-setup';
import { computeFeedItemsChunks } from './lib/feed-items-chunks';
import { computeLastModifiedBlogsDate } from './lib/last-modified-blogs-date';

const dirName = url.fileURLToPath(new URL('.', import.meta.url));

/**
 * セクションページ用のデータ。
 * 固定の公開パスの feed.json に、管理用ID・表示用のチャンク・最終更新日時を対応付ける。
 */
export default async () => {
  const sections = [];

  for (const section of DISPLAY_SECTION_LIST) {
    const feedJsonPath = path.join(dirName, '..', section.feedDirectory, sectionPathId(section.id), 'feeds/feed.json');
    const feedData = JSON.parse(await fs.readFile(feedJsonPath, 'utf-8'));
    const feedItems = feedData.items ?? [];

    sections.push({
      id: section.id,
      title: section.title,
      feedItemsChunks: computeFeedItemsChunks(feedItems, dayjs()),
      // 記事が1件も無い期間はページの最終更新日時を出せないため空にする
      lastModified: feedItems.length > 0 ? computeLastModifiedBlogsDate(feedItems) : '',
    });
  }

  return sections;
};
