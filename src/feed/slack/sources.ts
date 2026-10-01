import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import constants, { generatedFeedUrls, sectionFeedUrls } from '../../common/constants';
import { DISPLAY_SECTION_LIST } from '../../resources/display-section-list';
import { FEED_SECTION_LIST } from '../../resources/feed-info-list';
import { sectionFeedLanguage } from '../../resources/feed-language';
import { GENERATED_FEED_DEFINITION_MAP } from '../../resources/generated-feed-list';
import { sectionPathId } from '../../resources/section-paths';
import { statisticsFeedUrls } from '../statistics/config';
import type { SlackSource } from './types';

/** 同一実行の出力ファイルを読み、自サイトへのHTTP再取得を避ける。 */
export const loadSlackSources = async (
  siteDirectory: string,
  generatedIds: readonly string[],
): Promise<SlackSource[]> => {
  const sources: { rssUrl: string; file: string; language?: string }[] = [
    { rssUrl: constants.feedUrls.rss, file: 'feeds/feed.json' },
    ...DISPLAY_SECTION_LIST.map((section) => ({
      rssUrl: sectionFeedUrls(section.id).rss,
      file: `${section.feedDirectory}/${sectionPathId(section.id)}/feeds/feed.json`,
      language: sectionFeedLanguage(FEED_SECTION_LIST.find((source) => source.id === section.id)?.feedInfoList ?? []),
    })),
    ...generatedIds.map((id) => ({
      rssUrl: generatedFeedUrls(id).rss,
      file: `feeds/generated/${id}/feed.json`,
      language: GENERATED_FEED_DEFINITION_MAP.get(id)?.language,
    })),
    { rssUrl: statisticsFeedUrls.rss, file: 'feeds/statistics/daily/feed.json' },
  ];
  return Promise.all(
    sources.map(async (source) => ({
      rssUrl: source.rssUrl,
      language: source.language ?? constants.feedLanguage,
      rssPath: source.file.replace(/feed\.json$/, 'rss.xml'),
      json: await fs.readFile(path.join(siteDirectory, source.file), 'utf-8'),
    })),
  );
};
