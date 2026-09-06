/** CSSセレクターによる記事抽出設定 */
export interface CssGeneratedFeedExtractorConfig {
  type: 'css';
  itemSelector: string;
  titleSelector: string;
  linkSelector: string;
  dateSelector: string;
  dateAttribute?: string;
  timeSelector?: string;
  timeAttribute?: string;
  timeZoneOffset: string;
  summarySelector?: string;
  categorySelector?: string;
  creatorSelector?: string;
}

/** TypeScriptアダプターによる記事抽出設定 */
export interface AdapterGeneratedFeedExtractorConfig {
  type: 'adapter';
  name: string;
}

/** HTMLから記事を抽出する方式 */
export type GeneratedFeedExtractorConfig = CssGeneratedFeedExtractorConfig | AdapterGeneratedFeedExtractorConfig;

/** RSS非対応ページから生成するフィードの定義 */
export interface GeneratedFeedDefinition {
  id: string;
  schemaVersion: 1;
  label: string;
  pageUrl: string;
  language: string;
  extractor: GeneratedFeedExtractorConfig;
  pollIntervalMinutes: number;
  maxItems: number;
}

/** 生成フィードで保持する記事 */
export interface GeneratedFeedItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  categories: string[];
  creator: string;
}

/** 前回正常時の記事状態 */
export interface GeneratedFeedSnapshot {
  schemaVersion: 1;
  id: string;
  definitionHash: string;
  label: string;
  pageUrl: string;
  language: string;
  contentUpdatedAt: string;
  items: GeneratedFeedItem[];
}

/** 生成元の確認状態 */
export interface GeneratedFeedStatus {
  schemaVersion: 1;
  id: string;
  state: 'ok' | 'stale' | 'unavailable';
  lastCheckedAt: string;
  lastSuccessfulAt: string | null;
  contentUpdatedAt: string | null;
}

/** 復元可能な生成フィードの状態 */
export interface StoredGeneratedFeedState {
  snapshot: GeneratedFeedSnapshot;
  status: GeneratedFeedStatus | null;
}

/** 同一実行内で集約処理へ渡すRSS XML */
export type GeneratedFeedRegistry = Map<string, string>;

/** HTMLから生成フィードの記事を抽出する関数 */
export type GeneratedFeedExtractor = (definition: GeneratedFeedDefinition, html: string) => GeneratedFeedItem[];
