import { DEDUPLICATED_FEED_DEFINITION_LIST } from './deduplicated-feed-list';
import { FEED_SECTION_LIST, type FeedSection } from './feed-info-list';
import { validateSectionPaths } from './section-paths';
import { TRANSLATED_FEED_DEFINITION_LIST } from './translated-feed-list';

export interface DisplaySection extends Pick<FeedSection, 'id' | 'title'> {
  feedDirectory: 'section-feeds' | 'translated-feeds' | 'deduplicated-feeds';
}

/** 配信元・テーマごとに、重複除外版と集約元のカテゴリを隣接させる。 */
const SECTION_DISPLAY_ORDER = [
  // 企業・個人ブログ
  'my-tech-blog-jp-dedup',
  'my-tech-blog-jp',
  'company-tech-blog',
  'karaage-ai-news',
  'my-tech-blog-solo',
  // AI・開発
  'my-tech-blog-ai',
  'my-tech-blog-engineering',
  'my-tech-blog-platform',
  'my-tech-blog-programming',
  'my-tech-blog-db',
  'my-tech-blog-robotics',
  'my-tech-blog-robotics-zh',
  'autonomous-driving',
  // クラウド
  'aws',
  'aws-ja',
  'googlecloud',
  'googlecloud-ja',
  'azure',
  // セキュリティ
  'security',
  'security-en',
  'security-github',
  'jvn',
  'jpcert',
  // 投稿サービス
  'zenn-dedup',
  'zenn-trend',
  'zenn-ai',
  'zenn-physical-ai',
  'zenn-cloud',
  'zenn-security',
  'qiita-dedup',
  'qiita-trend',
  'qiita-ai',
  'qiita-physical-ai',
  'qiita-cloud',
  'qiita-security',
  // ニュース・メディア
  'hatenab-dedup',
  'hatenab',
  'menthas-dedup',
  'menthas',
  'publickey',
  'infoq',
  'thinkit',
  'developersio',
  'gihyo',
  'it-media-dedup',
  'it-media',
  'technoedge',
  'gigazine',
  'techcrunch',
  'hacker-news',
  'business-plus-it',
  // 資料・書籍
  'speakerdeck',
  'my-tech-book',
];

/** 翻訳版は原文カテゴリとひとまとまりにして扱う。 */
const sectionGroups = new Map<string, DisplaySection[]>(
  FEED_SECTION_LIST.map((section) => [
    section.id,
    [
      { id: section.id, title: section.title, feedDirectory: 'section-feeds' },
      ...TRANSLATED_FEED_DEFINITION_LIST.filter((definition) => definition.sourceSectionId === section.id).map(
        ({ id, title }): DisplaySection => ({ id, title, feedDirectory: 'translated-feeds' }),
      ),
    ],
  ]),
);
for (const { id, title } of DEDUPLICATED_FEED_DEFINITION_LIST) {
  sectionGroups.set(id, [{ id, title, feedDirectory: 'deduplicated-feeds' }]);
}
if (
  new Set(SECTION_DISPLAY_ORDER).size !== SECTION_DISPLAY_ORDER.length ||
  SECTION_DISPLAY_ORDER.some((id) => !sectionGroups.has(id))
) {
  throw new Error('カテゴリの表示順に重複または未定義のIDがあります');
}

/** 表示順未指定のカテゴリも末尾に含め、購読先の表示漏れを防ぐ。 */
export const DISPLAY_SECTION_LIST: DisplaySection[] = [
  ...new Set([...SECTION_DISPLAY_ORDER, ...sectionGroups.keys()]),
].flatMap((id) => sectionGroups.get(id) ?? []);

validateSectionPaths(DISPLAY_SECTION_LIST.map((section) => section.id));
