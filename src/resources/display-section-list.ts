import { DEDUPLICATED_FEED_DEFINITION_LIST } from './deduplicated-feed-list';
import { FEED_SECTION_LIST, type FeedSection } from './feed-info-list';
import { TRANSLATED_FEED_DEFINITION_LIST } from './translated-feed-list';

export interface DisplaySection extends Pick<FeedSection, 'id' | 'title'> {
  feedDirectory: 'section-feeds' | 'translated-feeds' | 'deduplicated-feeds';
}

/** 通常カテゴリの直後に翻訳、一覧末尾に横断的な重複除外フィードを配置する。 */
export const DISPLAY_SECTION_LIST: DisplaySection[] = [
  ...FEED_SECTION_LIST.flatMap((section): DisplaySection[] => [
    { id: section.id, title: section.title, feedDirectory: 'section-feeds' },
    ...TRANSLATED_FEED_DEFINITION_LIST.filter((definition) => definition.sourceSectionId === section.id).map(
      ({ id, title }): DisplaySection => ({ id, title, feedDirectory: 'translated-feeds' }),
    ),
  ]),
  ...DEDUPLICATED_FEED_DEFINITION_LIST.map(
    ({ id, title }): DisplaySection => ({
      id,
      title,
      feedDirectory: 'deduplicated-feeds',
    }),
  ),
];
