import * as fs from 'node:fs';
import * as path from 'node:path';
import { FEED_SECTION_LIST, type FeedSection } from './feed-info-list';

export interface TranslatedFeedDefinition {
  id: string;
  title: string;
  sourceSectionId: string;
  sourceLanguage: 'en' | 'zh';
  targetLanguage: 'ja';
}

/** 派生フィードの名前・参照元・翻訳方向とIDの衝突を検証する */
export const parseTranslatedFeeds = (
  value: unknown,
  sections: readonly Pick<FeedSection, 'id' | 'title'>[],
): TranslatedFeedDefinition[] => {
  if (!Array.isArray(value)) {
    throw new Error('翻訳セクション定義は配列で指定してください');
  }
  const sourceIds = new Set(sections.map((section) => section.id));
  const ids = new Set(sourceIds);
  const translatedSources = new Set<string>();
  return value.map((entry: unknown) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('翻訳セクション定義が不正です');
    }
    const definition = entry as Record<string, unknown>;
    if (
      typeof definition.id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]*$/.test(definition.id) ||
      typeof definition.title !== 'string' ||
      definition.title.trim() === '' ||
      typeof definition.sourceSectionId !== 'string' ||
      !sourceIds.has(definition.sourceSectionId) ||
      (definition.sourceLanguage !== 'en' && definition.sourceLanguage !== 'zh') ||
      definition.targetLanguage !== 'ja'
    ) {
      throw new Error('翻訳セクションのID・表示名・参照元・翻訳方向が不正です');
    }
    if (ids.has(definition.id) || translatedSources.has(definition.sourceSectionId)) {
      throw new Error('翻訳セクションのIDまたは参照元が重複しています');
    }
    ids.add(definition.id);
    translatedSources.add(definition.sourceSectionId);
    return {
      id: definition.id,
      title: definition.title,
      sourceSectionId: definition.sourceSectionId,
      sourceLanguage: definition.sourceLanguage,
      targetLanguage: 'ja',
    };
  });
};

/** 翻訳フィードのIDを定義ファイル名から取得する */
export const parseTranslatedFeedFile = (fileName: string, value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || 'id' in value) {
    throw new Error('翻訳フィードはオブジェクトで定義し、IDはファイル名で指定してください');
  }
  const id = path.basename(fileName, '.json');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || fileName !== `${id}.json`) {
    throw new Error('翻訳フィードのファイル名が不正です');
  }
  return { ...value, id };
};

/** 翻訳専用ディレクトリの定義をファイル名順で読み込む */
const loadTranslatedFeeds = (): TranslatedFeedDefinition[] => {
  const directory = new URL('./translated-feeds/', import.meta.url);
  const definitions = fs
    .readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) =>
      parseTranslatedFeedFile(fileName, JSON.parse(fs.readFileSync(new URL(fileName, directory), 'utf-8'))),
    );
  return parseTranslatedFeeds(definitions, FEED_SECTION_LIST);
};

export const TRANSLATED_FEED_DEFINITION_LIST = loadTranslatedFeeds();
