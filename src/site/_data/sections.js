import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';
import { FEED_SECTION_LIST } from '../../resources/feed-info-list';
import { dayjs } from './lib/dayjs-setup';
import { computeFeedItemsChunks } from './lib/feed-items-chunks';
import { computeLastModifiedBlogsDate } from './lib/last-modified-blogs-date';

const dirName = url.fileURLToPath(new URL('.', import.meta.url));

/**
 * セクションページ用のデータ。
 * セクションごとの feed.json を読み込み、表示用のチャンクと最終更新日時を付与して返す。
 * セクションIDはビルド時に決まるため、静的 import ではなくファイル読み込みで取得する
 */
export default async () => {
  const sections = [];

  for (const section of FEED_SECTION_LIST) {
    const feedJsonPath = path.join(dirName, '../section-feeds', section.id, 'feeds/feed.json');
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
