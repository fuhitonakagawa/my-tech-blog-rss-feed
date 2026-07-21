import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

type ValidUrl = `${'http' | 'https'}://${string}.${string}`;

export interface FeedInfo {
  label: string;
  url: ValidUrl;
  sectionId: string;
}

/**
 * フィードのセクション。セクションごとに専用ページ（/rss/<id>/）と
 * まとめフィード（/rss/<id>/feeds/atom.xml など）を配信する。
 *
 * セクションは resources/sections/<id>.json で1セクション1ファイルで管理する。
 * - ファイル名（拡張子を除く）がセクションIDになる
 * - JSONの形式: { "order": 表示順の数値, "title": "表示名", "feeds": [{ "label": "フィード名", "url": "フィードURL" }] }
 * - ラベル・URLはセクションをまたいで重複するとバリデーションエラーになる（同一フィードの複数セクション所属は不可）
 */
export interface FeedSection {
  /** URLスラッグ。英小文字・数字・ハイフンのみ */
  id: string;
  /** ナビゲーションや見出しに使う表示名 */
  title: string;
  feedInfoList: FeedInfo[];
}

interface SectionFileContent {
  /** セクションの表示順。小さいほど先頭 */
  order: number;
  title: string;
  feeds: {
    label: string;
    url: string;
  }[];
}

const SECTION_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const FEED_URL_PATTERN = /^https?:\/\/.+\..+/;

const dirName = url.fileURLToPath(new URL('.', import.meta.url));
const SECTIONS_DIR_PATH = path.join(dirName, 'sections');

/**
 * セクション定義JSONの形式チェック。不正があればファイル名付きのエラーを投げる
 */
function assertSectionFileContent(fileName: string, content: unknown): asserts content is SectionFileContent {
  const sectionContent = content as SectionFileContent;

  if (typeof sectionContent.order !== 'number') {
    throw new Error(`セクション定義「${fileName}」の order は数値で指定してください`);
  }
  if (typeof sectionContent.title !== 'string' || sectionContent.title === '') {
    throw new Error(`セクション定義「${fileName}」の title は空でない文字列で指定してください`);
  }
  if (!Array.isArray(sectionContent.feeds)) {
    throw new Error(`セクション定義「${fileName}」の feeds は配列で指定してください`);
  }
  for (const feed of sectionContent.feeds) {
    if (typeof feed?.label !== 'string' || feed.label === '') {
      throw new Error(`セクション定義「${fileName}」の feeds に label が不正な項目があります`);
    }
    if (typeof feed?.url !== 'string' || !FEED_URL_PATTERN.test(feed.url)) {
      throw new Error(`セクション定義「${fileName}」のフィード「${feed?.label}」のURLが不正です: ${feed?.url}`);
    }
  }
}

/**
 * resources/sections/*.json を読み込み、order 昇順（同値はID昇順）のセクション一覧を返す
 */
const loadFeedSectionList = (): FeedSection[] => {
  const sectionFileNames = fs
    .readdirSync(SECTIONS_DIR_PATH)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort();

  const sections: { order: number; section: FeedSection }[] = [];

  for (const fileName of sectionFileNames) {
    const sectionId = path.basename(fileName, '.json');
    if (!SECTION_ID_PATTERN.test(sectionId)) {
      throw new Error(`セクションID「${sectionId}」はURLスラッグとして不正です（英小文字・数字・ハイフンのみ）`);
    }

    const content: unknown = JSON.parse(fs.readFileSync(path.join(SECTIONS_DIR_PATH, fileName), 'utf-8'));
    assertSectionFileContent(fileName, content);

    sections.push({
      order: content.order,
      section: {
        id: sectionId,
        title: content.title,
        feedInfoList: content.feeds.map((feed) => ({
          label: feed.label,
          url: feed.url as ValidUrl,
          sectionId: sectionId,
        })),
      },
    });
  }

  sections.sort((a, b) => a.order - b.order || a.section.id.localeCompare(b.section.id));

  return sections.map((entry) => entry.section);
};

/** セクションごとのフィード情報一覧 */
export const FEED_SECTION_LIST: FeedSection[] = loadFeedSectionList();

/** 全セクションを横断したフィード情報一覧 */
export const FEED_INFO_LIST: FeedInfo[] = FEED_SECTION_LIST.flatMap((section) => section.feedInfoList);
