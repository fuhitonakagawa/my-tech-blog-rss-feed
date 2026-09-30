import { removeInvalidUnicode } from './common-util';

/** 通知履歴にも保存できる記事識別子と表示タグの上限。 */
export const feedItemLimits = {
  guidLength: 8192,
  tagLength: 2000,
};

/** 表示タグを公開形式・通知履歴で共通の文字制限に収める。 */
export const normalizeFeedItemTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => removeInvalidUnicode(tag).slice(0, feedItemLimits.tagLength))
    .filter((tag) => tag.trim() !== '');
};
