import { isDeliverableIdentifier } from '../feed-item-policy';
import { getGeneratedFeedAdapter } from './adapter-registry';
import { extractCssGeneratedFeedItems } from './css-extractor';
import type { GeneratedFeedDefinition, GeneratedFeedItem } from './types';

/** 生成フィード定義で指定された方式により記事を抽出する */
export const extractGeneratedFeedItems = (definition: GeneratedFeedDefinition, html: string): GeneratedFeedItem[] => {
  const items =
    definition.extractor.type === 'css'
      ? extractCssGeneratedFeedItems(definition, html, definition.extractor)
      : getGeneratedFeedAdapter(definition.extractor.name)(definition, html);
  const validItems = items.filter((item) => isDeliverableIdentifier(item.id));
  if (validItems.length === 0) throw new Error(`生成フィード「${definition.label}」の配信可能な記事がありません`);
  return validItems;
};

/** 参照する抽出アダプターが登録済みであることを検証する */
export const assertGeneratedFeedExtractor = (definition: GeneratedFeedDefinition): void => {
  if (definition.extractor.type === 'adapter') {
    getGeneratedFeedAdapter(definition.extractor.name);
  }
};
