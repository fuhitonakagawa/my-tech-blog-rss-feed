import { isPublishableHttpUrl } from '../common/url-guard';
import { removeInvalidUnicode } from './common-util';
import { logger } from './logger';

/** 通知履歴にも保存できる記事識別子と表示タグの上限。 */
export const feedItemLimits = {
  guidLength: 8192,
  tagLength: 2000,
};

/** 保存上限をUTF-16長で守り、切断位置の単独サロゲートを出力しない。 */
export const boundedFeedText = (text: string, limit: number, multiline = false): string => {
  const normalize = (value: string): string =>
    multiline ? value.split('\n').map(removeInvalidUnicode).join('\n') : removeInvalidUnicode(value);
  return normalize(normalize(text).slice(0, limit));
};

/** 公開可能なGUIDを優先し、GUIDがURLとして非公開なら記事URLを識別子にする。 */
export const feedItemIdentifier = (url: string, guid: unknown): string =>
  typeof guid === 'string' && guid && (!/^https?:/i.test(guid) || isPublishableHttpUrl(guid)) ? guid : url;

/** 不正な識別子は切り詰めず、配信候補から除外する。 */
export const isDeliverableIdentifier = (identifier: string): boolean => {
  if (identifier.length > feedItemLimits.guidLength) {
    logger.warn('[feed-item] identifier-too-long', { length: identifier.length });
    return false;
  }
  if (!identifier || removeInvalidUnicode(identifier) !== identifier) {
    logger.warn('[feed-item] invalid-identifier');
    return false;
  }
  return true;
};

/** 表示タグを公開形式・通知履歴で共通の文字制限に収める。 */
export const normalizeFeedItemTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => boundedFeedText(tag, feedItemLimits.tagLength))
    .filter((tag) => tag.trim() !== '');
};
