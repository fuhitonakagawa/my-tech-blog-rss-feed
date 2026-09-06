import { getGeneratedFeedAdapter } from './adapter-registry';
import { extractCssGeneratedFeedItems } from './css-extractor';
import type { GeneratedFeedDefinition, GeneratedFeedItem } from './types';

/** 生成フィード定義で指定された方式により記事を抽出する */
export const extractGeneratedFeedItems = (definition: GeneratedFeedDefinition, html: string): GeneratedFeedItem[] => {
  if (definition.extractor.type === 'css') {
    return extractCssGeneratedFeedItems(definition, html, definition.extractor);
  }

  return getGeneratedFeedAdapter(definition.extractor.name)(definition, html);
};

/** 参照する抽出アダプターが登録済みであることを検証する */
export const assertGeneratedFeedExtractor = (definition: GeneratedFeedDefinition): void => {
  if (definition.extractor.type === 'adapter') {
    getGeneratedFeedAdapter(definition.extractor.name);
  }
};
