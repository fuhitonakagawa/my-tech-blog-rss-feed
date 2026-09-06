import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { isPublishableHttpUrl } from '../common/url-guard';
import type {
  CssGeneratedFeedExtractorConfig,
  GeneratedFeedDefinition,
  GeneratedFeedExtractorConfig,
} from '../feed/generated/types';

interface GeneratedFeedFileContent {
  schemaVersion: unknown;
  label: unknown;
  pageUrl: unknown;
  language: unknown;
  extractor: unknown;
  pollIntervalMinutes: unknown;
  maxItems: unknown;
}

const GENERATED_FEED_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const TIME_ZONE_OFFSET_PATTERN = /^(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const REQUIRED_CSS_EXTRACTOR_KEYS = [
  'itemSelector',
  'titleSelector',
  'linkSelector',
  'dateSelector',
] as const satisfies readonly (keyof CssGeneratedFeedExtractorConfig)[];
const OPTIONAL_CSS_EXTRACTOR_KEYS = [
  'dateAttribute',
  'timeSelector',
  'timeAttribute',
  'summarySelector',
  'categorySelector',
  'creatorSelector',
] as const satisfies readonly (keyof CssGeneratedFeedExtractorConfig)[];

const dirName = url.fileURLToPath(new URL('.', import.meta.url));
const GENERATED_FEEDS_DIR_PATH = path.join(dirName, 'generated-feeds');

/** 空でない文字列であることを検証する */
function assertNonEmptyString(fileName: string, key: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`生成フィード定義「${fileName}」の ${key} は空でない文字列で指定してください`);
  }
}

/** 正の整数であることを検証する */
function assertPositiveInteger(fileName: string, key: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`生成フィード定義「${fileName}」の ${key} は正の整数で指定してください`);
  }
}

/** CSS抽出設定を検証する */
const assertCssExtractor = (fileName: string, extractor: Record<string, unknown>): void => {
  for (const key of REQUIRED_CSS_EXTRACTOR_KEYS) {
    assertNonEmptyString(fileName, `extractor.${key}`, extractor[key]);
  }

  for (const key of OPTIONAL_CSS_EXTRACTOR_KEYS) {
    const value = extractor[key];
    if (value !== undefined) {
      assertNonEmptyString(fileName, `extractor.${key}`, value);
    }
  }

  if (extractor.timeAttribute !== undefined && extractor.timeSelector === undefined) {
    throw new Error(`生成フィード定義「${fileName}」の extractor.timeAttribute には timeSelector が必要です`);
  }
  if (typeof extractor.timeZoneOffset !== 'string' || !TIME_ZONE_OFFSET_PATTERN.test(extractor.timeZoneOffset)) {
    throw new Error(`生成フィード定義「${fileName}」の extractor.timeZoneOffset が不正です`);
  }
};

/** 記事抽出設定を検証する */
const toExtractor = (fileName: string, value: unknown): GeneratedFeedExtractorConfig => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`生成フィード定義「${fileName}」の extractor が不正です`);
  }

  const extractor = value as Record<string, unknown>;
  if (extractor.type === 'css') {
    assertCssExtractor(fileName, extractor);
    return extractor as unknown as CssGeneratedFeedExtractorConfig;
  }
  if (extractor.type === 'adapter') {
    assertNonEmptyString(fileName, 'extractor.name', extractor.name);
    return {
      type: 'adapter',
      name: extractor.name,
    };
  }

  throw new Error(`生成フィード定義「${fileName}」の extractor.type が不正です`);
};

/** 生成フィード定義を検証する */
export const parseGeneratedFeedDefinition = (fileName: string, id: string, value: unknown): GeneratedFeedDefinition => {
  if (!GENERATED_FEED_ID_PATTERN.test(id)) {
    throw new Error(`生成フィードID「${id}」は英小文字・数字・ハイフンのみ使用できます`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`生成フィード定義「${fileName}」の内容が不正です`);
  }

  const content = value as GeneratedFeedFileContent;
  if (content.schemaVersion !== 1) {
    throw new Error(`生成フィード定義「${fileName}」の schemaVersion は 1 を指定してください`);
  }
  assertNonEmptyString(fileName, 'label', content.label);
  assertNonEmptyString(fileName, 'pageUrl', content.pageUrl);
  if (!isPublishableHttpUrl(content.pageUrl)) {
    throw new Error(`生成フィード定義「${fileName}」の pageUrl が不正です`);
  }
  assertNonEmptyString(fileName, 'language', content.language);
  const extractor = toExtractor(fileName, content.extractor);
  assertPositiveInteger(fileName, 'pollIntervalMinutes', content.pollIntervalMinutes);
  assertPositiveInteger(fileName, 'maxItems', content.maxItems);

  return {
    id,
    schemaVersion: 1,
    label: content.label,
    pageUrl: content.pageUrl,
    language: content.language,
    extractor,
    pollIntervalMinutes: content.pollIntervalMinutes,
    maxItems: content.maxItems,
  };
};

/** 生成フィード定義をID順で読み込む */
const loadGeneratedFeedDefinitions = (): GeneratedFeedDefinition[] => {
  const fileNames = fs
    .readdirSync(GENERATED_FEEDS_DIR_PATH)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort();
  const definitions: GeneratedFeedDefinition[] = [];
  const labels = new Set<string>();
  const pageUrls = new Set<string>();

  for (const fileName of fileNames) {
    const id = path.basename(fileName, '.json');
    const content: unknown = JSON.parse(fs.readFileSync(path.join(GENERATED_FEEDS_DIR_PATH, fileName), 'utf-8'));
    const definition = parseGeneratedFeedDefinition(fileName, id, content);
    if (labels.has(definition.label)) {
      throw new Error(`生成フィードのラベル「${definition.label}」が重複しています`);
    }
    if (pageUrls.has(definition.pageUrl)) {
      throw new Error(`生成フィードのページURL「${definition.pageUrl}」が重複しています`);
    }
    labels.add(definition.label);
    pageUrls.add(definition.pageUrl);
    definitions.push(definition);
  }

  return definitions;
};

/** RSS非対応ページから生成するフィード定義一覧 */
export const GENERATED_FEED_DEFINITION_LIST: GeneratedFeedDefinition[] = loadGeneratedFeedDefinitions();

/** 生成フィードIDから定義を引くための一覧 */
export const GENERATED_FEED_DEFINITION_MAP: ReadonlyMap<string, GeneratedFeedDefinition> = new Map(
  GENERATED_FEED_DEFINITION_LIST.map((definition) => [definition.id, definition]),
);
