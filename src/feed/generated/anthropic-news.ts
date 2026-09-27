import { type CheerioAPI, load } from 'cheerio';
import { isPublishableHttpUrl } from '../../common/url-guard';
import { normalizeArticleUrl, removeInvalidUnicode } from '../common-util';
import { logger } from '../logger';
import type { GeneratedFeedDefinition, GeneratedFeedItem } from './types';

type HtmlSelection = ReturnType<CheerioAPI>;

const ARTICLE_SELECTOR = [
  'main a[class*="PublicationList"][class*="__listItem"]',
  'main a[class*="FeaturedGrid"][class*="__content"]',
  'main a[class*="FeaturedGrid"][class*="__sideLink"]',
].join(', ');
const TITLE_SELECTOR = 'h2, h3, h4, [class*="PublicationList"][class*="__title"]';
const CATEGORY_SELECTOR =
  '[class*="PublicationList"][class*="__subject"], [class*="FeaturedGrid"][class*="__meta"] > span';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 記事内の指定要素のテキストを1行に正規化する */
const extractText = (article: HtmlSelection, selector: string): string => {
  return removeInvalidUnicode(article.find(selector).first().text()).replace(/\s+/g, ' ').trim();
};

/** 時刻のない英語表記の掲載日をUTCの午前0時として返す */
const parsePublicationDate = (value: string): string => {
  const match = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(value);
  if (!match) {
    throw new Error('公開日の形式が不正です');
  }
  const month = MONTHS.indexOf(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (month < 0 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    throw new Error('公開日が存在しません');
  }
  return date.toISOString();
};

/** タイトル・Anthropic内の公開URL・掲載日が有効な記事を返す */
const extractArticle = (definition: GeneratedFeedDefinition, article: HtmlSelection): GeneratedFeedItem => {
  const title = extractText(article, TITLE_SELECTOR);
  const href = article.attr('href')?.trim();
  if (!title || !href) {
    throw new Error('タイトルまたは記事URLがありません');
  }
  const url = normalizeArticleUrl(new URL(href, definition.pageUrl).toString());
  if (!isPublishableHttpUrl(url) || new URL(url).origin !== new URL(definition.pageUrl).origin) {
    throw new Error('公開できない記事URLです');
  }
  const category = extractText(article, CATEGORY_SELECTOR);
  return {
    id: url,
    title,
    url,
    publishedAt: parsePublicationDate(extractText(article, 'time')),
    summary: extractText(article, 'p'),
    creator: '',
    categories: category ? [category] : [],
  };
};

/** Anthropicの注目記事と通常一覧を抽出し、同一URLの記事は先頭の掲載を優先する */
export const extractAnthropicNews = (definition: GeneratedFeedDefinition, html: string): GeneratedFeedItem[] => {
  const $ = load(html);
  const items = new Map<string, GeneratedFeedItem>();
  $(ARTICLE_SELECTOR).each((index, element) => {
    try {
      const item = extractArticle(definition, $(element));
      if (!items.has(item.id)) {
        items.set(item.id, item);
      }
    } catch {
      logger.warn('[generated-feed] 必須項目が不正な記事を除外します', definition.id, index + 1);
    }
  });
  if (items.size === 0) {
    throw new Error(`生成フィード「${definition.label}」の有効な記事を取得できません`);
  }
  return [...items.values()];
};
