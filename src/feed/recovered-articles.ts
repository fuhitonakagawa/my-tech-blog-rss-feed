import constants from '../common/constants';
import { isPublishableHttpUrl } from '../common/url-guard';
import type { FeedInfo } from '../resources/feed-info-list';
import definitions from '../resources/recovered-articles.json' with { type: 'json' };
import { normalizeArticleUrl, removeInvalidUnicode } from './common-util';
import type { CustomRssParserFeed, CustomRssParserItem } from './feed-crawler';
import { parsePublicationDate } from './publication-metadata';

export interface RecoveredArticle {
  sourceFeedUrl: string;
  url: string;
  title: string;
  publishedAt: string;
}

/** 実在する公開元・記事URL・確認済みの公開日時を持つ復旧入力だけを受け付ける。 */
export const parseRecoveredArticles = (value: unknown): RecoveredArticle[] => {
  if (!Array.isArray(value)) throw new Error('復旧記事の定義が不正です');
  const keys = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('復旧記事の項目が不正です');
    const item = entry as RecoveredArticle;
    if (
      typeof item.sourceFeedUrl !== 'string' ||
      !isPublishableHttpUrl(item.sourceFeedUrl) ||
      typeof item.url !== 'string' ||
      !isPublishableHttpUrl(item.url) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      removeInvalidUnicode(item.title) !== item.title ||
      typeof item.publishedAt !== 'string' ||
      parsePublicationDate(item.publishedAt) !== item.publishedAt
    )
      throw new Error('復旧記事の公開情報が不正です');
    const key = `${item.sourceFeedUrl}:${normalizeArticleUrl(item.url)}`;
    if (keys.has(key)) throw new Error('復旧記事が重複しています');
    keys.add(key);
    return {
      sourceFeedUrl: item.sourceFeedUrl,
      url: normalizeArticleUrl(item.url),
      title: item.title,
      publishedAt: item.publishedAt,
    };
  });
};

const articles = parseRecoveredArticles(definitions);

/** 元のカテゴリへ戻す記事だけを返し、期間外・未来の記事は再送しない。 */
export const recoveredFeedItems = (info: FeedInfo, now = new Date()): CustomRssParserItem[] => {
  const cutoff = new Date(now.getTime() - constants.aggregateFeedDurationInHours * 3600_000).toISOString();
  return articles
    .filter(
      (item) => item.sourceFeedUrl === info.url && item.publishedAt >= cutoff && item.publishedAt <= now.toISOString(),
    )
    .map((item) => ({
      title: item.title,
      link: item.url,
      guid: item.url,
      isoDate: item.publishedAt,
      pubDate: new Date(item.publishedAt).toUTCString(),
      summary: '',
      blogTitle: info.label,
      blogLink: info.pageUrl ?? info.url,
      sectionId: info.sectionId,
      sourceLanguage: info.language,
      sourceFeedUrl: info.url,
    }));
};

/** 取得できた原文を優先し、復旧入力によって同じ記事を二重にしない。 */
export const mergeRecoveredItems = (feed: CustomRssParserFeed, recovered: CustomRssParserItem[]): void => {
  const present = new Set(feed.items.map((item) => normalizeArticleUrl(item.link)));
  for (const item of recovered)
    if (!present.has(item.link)) {
      feed.items.push({ ...item, blogTitle: feed.title, blogLink: feed.link });
      present.add(item.link);
    }
};
