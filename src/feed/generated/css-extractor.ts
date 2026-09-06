import { type CheerioAPI, load } from 'cheerio';
import { isPublishableHttpUrl } from '../../common/url-guard';
import { normalizeArticleUrl, removeInvalidUnicode } from '../common-util';
import { logger } from '../logger';
import type { CssGeneratedFeedExtractorConfig, GeneratedFeedDefinition, GeneratedFeedItem } from './types';

type HtmlSelection = ReturnType<CheerioAPI>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;
const TIME_ZONE_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** HTML要素のテキストを1行に正規化する */
const normalizeText = (value: string): string => {
  return removeInvalidUnicode(value).replace(/\s+/g, ' ').trim();
};

/** CSSセレクターで指定した最初の要素から値を取得する */
const extractValue = (item: HtmlSelection, selector: string, attribute?: string): string => {
  const element = item.find(selector).first();
  const value = attribute ? element.attr(attribute) : element.text();
  return normalizeText(value ?? '');
};

/** CSSセレクターに一致するすべての要素からテキストを取得する */
const extractTextList = (item: HtmlSelection, selector?: string): string[] => {
  if (!selector) {
    return [];
  }

  return item
    .find(selector)
    .toArray()
    .map((element) => normalizeText(item.find(element).text()))
    .filter((value) => value !== '');
};

/** 日付と時刻をタイムゾーン付きISO 8601へ変換する */
const toIsoDate = (dateValue: string, timeValue: string, timeZoneOffset: string): string => {
  let dateTimeValue = timeValue ? `${dateValue}T${timeValue}` : dateValue;
  if (ISO_DATE_PATTERN.test(dateTimeValue)) {
    dateTimeValue = `${dateTimeValue}T00:00:00`;
  }
  if (!TIME_ZONE_PATTERN.test(dateTimeValue)) {
    dateTimeValue = `${dateTimeValue}${timeZoneOffset}`;
  }

  const dateParts = ISO_DATE_PREFIX_PATTERN.exec(dateTimeValue);
  if (dateParts) {
    const [, year, month, day] = dateParts.map(Number);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day
    ) {
      throw new Error(`公開日時をISO 8601として解釈できません: ${dateTimeValue}`);
    }
  }

  const date = new Date(dateTimeValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`公開日時をISO 8601として解釈できません: ${dateTimeValue}`);
  }

  return date.toISOString();
};

/** HTML上の1記事を生成フィードの記事へ変換する */
const extractItem = (
  definition: GeneratedFeedDefinition,
  config: CssGeneratedFeedExtractorConfig,
  item: HtmlSelection,
  itemIndex: number,
): GeneratedFeedItem | null => {
  const title = extractValue(item, config.titleSelector);
  const relativeUrl = extractValue(item, config.linkSelector, 'href');
  const dateValue = extractValue(item, config.dateSelector, config.dateAttribute);
  const timeValue = config.timeSelector ? extractValue(item, config.timeSelector, config.timeAttribute) : '';

  const missingKey = [
    ['titleSelector', title],
    ['linkSelector', relativeUrl],
    ['dateSelector', dateValue],
    ...(config.timeSelector ? [['timeSelector', timeValue]] : []),
  ].find(([, value]) => value === '')?.[0];
  if (missingKey) {
    logger.warn('[generated-feed] 必須項目を取得できない記事を除外します', definition.id, itemIndex + 1, missingKey);
    return null;
  }

  try {
    const articleUrl = normalizeArticleUrl(new URL(relativeUrl, definition.pageUrl).toString());
    if (!isPublishableHttpUrl(articleUrl)) {
      logger.warn('[generated-feed] 公開できないURLの記事を除外します', definition.id, itemIndex + 1);
      return null;
    }

    return {
      id: articleUrl,
      title,
      url: articleUrl,
      publishedAt: toIsoDate(dateValue, timeValue, config.timeZoneOffset),
      summary: config.summarySelector ? extractValue(item, config.summarySelector) : '',
      creator: config.creatorSelector ? extractValue(item, config.creatorSelector) : '',
      categories: extractTextList(item, config.categorySelector),
    };
  } catch (error) {
    logger.warn('[generated-feed] URLまたは公開日時が不正な記事を除外します', definition.id, itemIndex + 1);
    logger.trace(error);
    return null;
  }
};

/** CSSセレクター設定に従ってHTMLから記事を抽出する */
export const extractCssGeneratedFeedItems = (
  definition: GeneratedFeedDefinition,
  html: string,
  config: CssGeneratedFeedExtractorConfig,
): GeneratedFeedItem[] => {
  const $ = load(html);
  const itemElements = $(config.itemSelector).toArray();
  if (itemElements.length === 0) {
    throw new Error(`生成フィード「${definition.label}」の記事を取得できません`);
  }

  const items = itemElements
    .map((element, itemIndex) => extractItem(definition, config, $(element), itemIndex))
    .filter((item): item is GeneratedFeedItem => item !== null);
  if (items.length === 0) {
    throw new Error(`生成フィード「${definition.label}」の有効な記事を取得できません`);
  }
  const itemIds = new Set<string>();
  for (const item of items) {
    if (itemIds.has(item.id)) {
      throw new Error(`生成フィード「${definition.label}」の記事ID「${item.id}」が重複しています`);
    }
    itemIds.add(item.id);
  }

  return items;
};
