import { type CheerioAPI, load } from 'cheerio';
import { isPublishableHttpUrl } from '../../common/url-guard';
import { normalizeArticleUrl, removeInvalidUnicode } from '../common-util';
import { logger } from '../logger';
import { parseEnglishPublicationDate } from './publication-date';
import type { GeneratedFeedDefinition, GeneratedFeedItem } from './types';

type HtmlSelection = ReturnType<CheerioAPI>;

const ARTICLE_SELECTOR = [
  'main a[class*="PublicationList"][class*="__listItem"]',
  'main a[class*="FeaturedGrid"][class*="__content"]',
  'main a[class*="FeaturedGrid"][class*="__sideLink"]',
  'main a[class*="FeaturedGrid"][class*="__tileLink"]',
  'main a[class*="TableView"][class*="__title-link"]',
  'main article > a[class*="_tileLink"]',
  'main [data-listing-row] a[class*="_title-link"]',
].join(', ');
const TITLE_SELECTOR = 'h2, h3, h4, [class*="PublicationList"][class*="__title"]';
const CATEGORY_SELECTOR =
  '[class*="PublicationList"][class*="__subject"], [class*="FeaturedGrid"][class*="__meta"] > span';

/** 記事内の指定要素のテキストを1行に正規化する */
const extractText = (article: HtmlSelection, selector: string): string => {
  return removeInvalidUnicode(article.find(selector).first().text()).replace(/\s+/g, ' ').trim();
};

/** タイトル・Anthropic内の公開URL・掲載日が有効な記事を返す */
const extractArticle = (definition: GeneratedFeedDefinition, article: HtmlSelection): GeneratedFeedItem => {
  const title = extractText(article, TITLE_SELECTOR);
  const href = article.attr('href')?.trim();
  if (!title || !href) {
    throw new Error('タイトルまたは記事URLがありません');
  }
  if (removeInvalidUnicode(href) !== href || href.includes('\uFFFD')) throw new Error('記事URLに不正な文字があります');
  const url = normalizeArticleUrl(new URL(href, definition.pageUrl).toString());
  if (!isPublishableHttpUrl(url) || new URL(url).origin !== new URL(definition.pageUrl).origin) {
    throw new Error('公開できない記事URLです');
  }
  // 日付・カテゴリがリンクの外にあるレイアウトでは、同じカード・行だけを参照する。
  const container = article.is('[class*="_tileLink"]')
    ? article.closest('article')
    : article.is('[class*="_title-link"]')
      ? article.closest('li')
      : article;
  const category = extractText(
    container,
    `${CATEGORY_SELECTOR}, header [class*="TopicLink"], header a[href^="/news/"], [class*="_category-link"]`,
  );
  return {
    id: url,
    title,
    url,
    publishedAt: parseEnglishPublicationDate(extractText(container, 'time')),
    summary: extractText(article, 'p') || extractText(container, 'a[class*="_above-link"] p'),
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
