import { load } from 'cheerio';
import { isPublishableHttpUrl } from '../../common/url-guard';
import { normalizeArticleUrl, removeInvalidUnicode } from '../common-util';
import { logger } from '../logger';
import { parseEnglishPublicationDate } from './publication-date';
import type { GeneratedFeedExtractor } from './types';

/** サイト移行後も旧記事のGUIDを引き継ぎ、リンクは現在の掲載先を使う。 */
export const claudeArticleId = (url: string): string => {
  const current = new URL(url);
  if (current.hostname === 'claude.com' && current.pathname.startsWith('/resources/articles/')) {
    current.pathname = current.pathname.replace('/resources/articles/', '/blog/');
  } else if (current.hostname === 'claude.dev' && current.pathname.startsWith('/blog/')) {
    current.hostname = 'claude.com';
    current.pathname = current.pathname.replace(/\/$/, '');
  }
  return current.href;
};

/** 絞り込まれた記事グリッドから抽出し、特集・ナビゲーションを含めない。 */
export const extractClaudeArticles: GeneratedFeedExtractor = (definition, html) => {
  const $ = load(html);
  const items = new Map<string, ReturnType<GeneratedFeedExtractor>[number]>();
  $('main [data-card-group="true"] > a[data-cta-position="resourcesTypeIndex"]').each((_, element) => {
    const card = $(element);
    const title = removeInvalidUnicode(card.find('h3').first().text()).replace(/\s+/g, ' ').trim();
    const href = card.attr('href') ?? '';
    try {
      if (!title || !href || removeInvalidUnicode(href) !== href) throw new Error('記事情報が不正です');
      const url = normalizeArticleUrl(new URL(href, definition.pageUrl).href);
      if (!isPublishableHttpUrl(url)) throw new Error('記事URLを公開できません');
      // 日付はカードのヘッダー内から読み、本文・取得時刻で代用しない。
      const dates = card
        .find('div > span')
        .toArray()
        .map((node) => $(node).text().trim());
      const date = dates.find((value) => /^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(value)) ?? '';
      const id = claudeArticleId(url);
      items.set(id, {
        id,
        url,
        title,
        publishedAt: parseEnglishPublicationDate(date),
        summary: removeInvalidUnicode(card.find('p').first().text()).replace(/\s+/g, ' ').trim(),
        creator: '',
        categories: definition.id === 'claude-code-blog' ? ['Claude Code'] : ['Product announcements'],
      });
    } catch {
      logger.warn('[generated-feed] 不正なClaude記事を除外します', definition.id, href);
    }
  });
  if (!items.size) throw new Error(`生成フィード「${definition.label}」の有効な記事を取得できません`);
  return [...items.values()];
};
