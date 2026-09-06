import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { generatedFeedUrls } from '../common/constants';
import { isValidHttpUrl } from '../common/url-guard';
import { GENERATED_FEED_DEFINITION_MAP } from './generated-feed-list';

type ValidUrl = `${'http' | 'https'}://${string}.${string}`;

/** 外部サイトが配信するフィード */
export interface RemoteFeedInput {
  kind: 'remote';
  url: ValidUrl;
}

/** 同一実行内で生成するフィード */
export interface GeneratedFeedInput {
  kind: 'generated';
  id: string;
}

/** 集約処理へ渡すフィードの入力元 */
export type FeedInput = RemoteFeedInput | GeneratedFeedInput;

export interface FeedInfo {
  label: string;
  url: ValidUrl;
  sectionId: string;
  pageUrl?: ValidUrl;
  input: FeedInput;
}

/**
 * フィードのセクション。セクションごとに専用ページ（/rss/<id>/）と
 * まとめフィード（/rss/<id>/feeds/atom.xml など）を配信する。
 *
 * セクションは resources/sections/<id>.json で1セクション1ファイルで管理する。
 * - ファイル名（拡張子を除く）がセクションIDになる
 * - feedsは外部フィードのlabel・url、または生成フィードのgeneratedFeedIdを持つ
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
  feeds: unknown[];
}

interface RemoteSectionFeed extends Record<string, unknown> {
  label: string;
  url: string;
}

interface GeneratedSectionFeed extends Record<string, unknown> {
  generatedFeedId: string;
}

const SECTION_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const dirName = url.fileURLToPath(new URL('.', import.meta.url));
const SECTIONS_DIR_PATH = path.join(dirName, 'sections');

/** 外部フィードの定義であることを検証する */
const isRemoteSectionFeed = (value: Record<string, unknown>): value is RemoteSectionFeed => {
  return typeof value.label === 'string' && typeof value.url === 'string' && value.generatedFeedId === undefined;
};

/** 生成フィード参照であることを検証する */
const isGeneratedSectionFeed = (value: Record<string, unknown>): value is GeneratedSectionFeed => {
  return typeof value.generatedFeedId === 'string' && value.label === undefined && value.url === undefined;
};

/** セクション内のフィード定義を集約用の情報へ変換する */
const toFeedInfo = (fileName: string, sectionId: string, value: unknown): FeedInfo => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`セクション定義「${fileName}」の feeds に不正な項目があります`);
  }

  const feed = value as Record<string, unknown>;
  if (isRemoteSectionFeed(feed)) {
    if (feed.label.trim() === '') {
      throw new Error(`セクション定義「${fileName}」の feeds に label が不正な項目があります`);
    }
    if (!isValidHttpUrl(feed.url)) {
      throw new Error(`セクション定義「${fileName}」のフィード「${feed.label}」のURLが不正です: ${feed.url}`);
    }

    return {
      label: feed.label,
      url: feed.url as ValidUrl,
      sectionId,
      input: {
        kind: 'remote',
        url: feed.url as ValidUrl,
      },
    };
  }

  if (isGeneratedSectionFeed(feed)) {
    const definition = GENERATED_FEED_DEFINITION_MAP.get(feed.generatedFeedId);
    if (!definition) {
      throw new Error(`セクション定義「${fileName}」が未定義の生成フィード「${feed.generatedFeedId}」を参照しています`);
    }

    return {
      label: definition.label,
      url: generatedFeedUrls(definition.id).rss as ValidUrl,
      pageUrl: definition.pageUrl as ValidUrl,
      sectionId,
      input: {
        kind: 'generated',
        id: definition.id,
      },
    };
  }

  throw new Error(`セクション定義「${fileName}」の feeds は label と url、または generatedFeedId を指定してください`);
};

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
        feedInfoList: content.feeds.map((feed) => toFeedInfo(fileName, sectionId, feed)),
      },
    });
  }

  sections.sort((a, b) => a.order - b.order || a.section.id.localeCompare(b.section.id));

  const feedInfoList = sections.flatMap((entry) => entry.section.feedInfoList);
  const labels = new Set<string>();
  const urls = new Set<string>();
  for (const feedInfo of feedInfoList) {
    if (labels.has(feedInfo.label)) {
      throw new Error(`フィードのラベル「${feedInfo.label}」が重複しています`);
    }
    if (urls.has(feedInfo.url)) {
      throw new Error(`フィードのURL「${feedInfo.url}」が重複しています`);
    }
    labels.add(feedInfo.label);
    urls.add(feedInfo.url);
  }

  return sections.map((entry) => entry.section);
};

/** セクションごとのフィード情報一覧 */
export const FEED_SECTION_LIST: FeedSection[] = loadFeedSectionList();

/** 全セクションを横断したフィード情報一覧 */
export const FEED_INFO_LIST: FeedInfo[] = FEED_SECTION_LIST.flatMap((section) => section.feedInfoList);
