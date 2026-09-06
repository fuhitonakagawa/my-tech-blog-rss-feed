import { extractCssGeneratedFeedItems } from './css-extractor';
import type {
  CssGeneratedFeedExtractorConfig,
  GeneratedFeedDefinition,
  GeneratedFeedExtractor,
  GeneratedFeedItem,
} from './types';

const SERVERLESS_OPERATIONS_EXTRACTOR: CssGeneratedFeedExtractorConfig = {
  type: 'css',
  itemSelector: 'main > ul > li',
  titleSelector: 'h3',
  linkSelector: 'a:has(h3)',
  dateSelector: 'time[datetime^="20"]',
  dateAttribute: 'datetime',
  timeSelector: 'time[datetime*=":"]',
  timeAttribute: 'datetime',
  timeZoneOffset: '+09:00',
  categorySelector: 'a[href^="/blog/tag/"]',
};

/** Serverless Operationsの記事一覧を抽出する */
const extractServerlessOperations: GeneratedFeedExtractor = (
  definition: GeneratedFeedDefinition,
  html: string,
): GeneratedFeedItem[] => {
  return extractCssGeneratedFeedItems(definition, html, SERVERLESS_OPERATIONS_EXTRACTOR).map((item) => ({
    ...item,
    categories: item.categories.map((category) => category.replace(/^#\s*/, '')),
  }));
};

const GENERATED_FEED_ADAPTERS: ReadonlyMap<string, GeneratedFeedExtractor> = new Map([
  ['serverless-operations', extractServerlessOperations],
]);

/** 登録済みの抽出アダプターを返す */
export const getGeneratedFeedAdapter = (name: string): GeneratedFeedExtractor => {
  const adapter = GENERATED_FEED_ADAPTERS.get(name);
  if (!adapter) {
    throw new Error(`生成フィードの抽出アダプター「${name}」が登録されていません`);
  }

  return adapter;
};
