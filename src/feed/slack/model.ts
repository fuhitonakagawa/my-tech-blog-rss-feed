import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { Feed } from 'feed';
import constants from '../../common/constants';
import { isPublishableHttpUrl, isValidImageDataUrl } from '../../common/url-guard';
import { escapeHtml } from '../../site/_includes/components/html-utils';
import { normalizeArticleUrl, removeInvalidUnicode } from '../common-util';
import { feedItemLimits, normalizeFeedItemTags } from '../feed-item-policy';
import { slackFeedConfig, slackSourcePath } from './config';
import type { SlackArticle, SlackFeedHistory, SlackSource } from './types';

const DAY_MS = 86_400_000;

/** 統計記事の日付フラグメントを保持して記事を識別する。 */
export const slackArticleKey = (url: string): string => {
  const normalized = new URL(normalizeArticleUrl(url));
  normalized.hash = new URL(url).hash;
  return createHash('sha256').update(normalized.href).digest('hex');
};

export const isSlackDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

/** JSON Feedの本文から、通知で読めるプレーンテキストを得る。 */
const summaryText = (item: Record<string, unknown>, statistics: boolean): string => {
  if (!statistics && typeof item.summary === 'string') return removeInvalidUnicode(item.summary).slice(0, 200_000);
  if (typeof item.content_text === 'string') return removeInvalidUnicode(item.content_text).slice(0, 200_000);
  if (typeof item.content_html !== 'string') return '';
  const document = load(item.content_html.slice(0, 400_000));
  document('script,style').remove();
  document('p,li,br').append('\n');
  return document.text().split('\n').map(removeInvalidUnicode).join('\n').trim().slice(0, 200_000);
};

/** 生成済みJSONから必要な公開情報だけを読む。 */
const parseSource = (
  source: SlackSource,
): { title: string; link: string; language: string; items: Omit<SlackArticle, 'firstSeenAt'>[] } => {
  const value: unknown = JSON.parse(source.json);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Slack用JSON Feedが不正です');
  const feed = value as Record<string, unknown>;
  if (typeof feed.title !== 'string' || !feed.title.trim() || !Array.isArray(feed.items))
    throw new Error('Slack用JSON Feedの項目が不正です');
  const items = feed.items.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Slack用の記事が不正です');
    const item = value as Record<string, unknown>;
    if (
      typeof item.url !== 'string' ||
      !isPublishableHttpUrl(item.url) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      !isSlackDate(item.date_published) ||
      typeof item.id !== 'string' ||
      !item.id ||
      item.id.length > feedItemLimits.guidLength ||
      removeInvalidUnicode(item.id) !== item.id
    ) {
      throw new Error('Slack用の記事URL・タイトル・公開日時が不正です');
    }
    const author =
      item.author && typeof item.author === 'object' && !Array.isArray(item.author)
        ? (item.author as Record<string, unknown>)
        : {};
    return {
      key: slackArticleKey(item.url),
      guid: item.id,
      url: item.url,
      title: removeInvalidUnicode(item.title).slice(0, 2000),
      summary: summaryText(item, source.rssUrl.endsWith('/feeds/statistics/daily/rss.xml')),
      image:
        typeof item.image === 'string' && (isPublishableHttpUrl(item.image) || isValidImageDataUrl(item.image))
          ? item.image
          : null,
      creator: typeof author.name === 'string' ? removeInvalidUnicode(author.name).slice(0, 2000) : null,
      tags: normalizeFeedItemTags(item.tags),
      originalPublishedAt: item.date_published,
    };
  });
  const link =
    typeof feed.home_page_url === 'string' && isPublishableHttpUrl(feed.home_page_url)
      ? feed.home_page_url
      : source.rssUrl;
  return {
    title: removeInvalidUnicode(feed.title).slice(0, 2000),
    language: source.language ?? constants.feedLanguage,
    link,
    items,
  };
};

/** 公開済みの記事は既存の日時・GUIDを引き継いで一斉再通知を防ぐ。 */
export const bootstrapSlackFeed = (source: SlackSource, now: Date): SlackFeedHistory => {
  const input = parseSource(source);
  const items = new Map<string, SlackArticle>();
  const seen: SlackFeedHistory['seen'] = {};
  for (const item of input.items) {
    if (Date.parse(item.originalPublishedAt) > now.getTime()) throw new Error('公開済みRSSに未来の公開日時があります');
    if (items.has(item.key)) continue;
    items.set(item.key, { ...item, firstSeenAt: item.originalPublishedAt });
    seen[item.key] = { guid: item.guid, firstSeenAt: item.originalPublishedAt, lastSeenAt: now.toISOString() };
  }
  const lastIssuedAt =
    [...items.values()]
      .map((item) => item.firstSeenAt)
      .sort()
      .at(-1) ?? now.toISOString();
  return {
    title: input.title,
    language: input.language,
    link: input.link,
    lastIssuedAt,
    items: [...items.values()],
    seen,
  };
};

/** 初回掲載日時を固定し、後着記事だけに前回より新しい通知日時を割り当てる。 */
export const updateSlackFeed = (
  source: SlackSource,
  previous: SlackFeedHistory | undefined,
  now: Date,
): SlackFeedHistory => {
  const input = parseSource(source);
  const nowMs = now.getTime();
  const seenCutoff = nowMs - slackFeedConfig.seenRetentionDays * DAY_MS;
  const itemCutoff = nowMs - slackFeedConfig.itemRetentionDays * DAY_MS;
  const seen = Object.fromEntries(
    Object.entries(previous?.seen ?? {}).filter(([, item]) => Date.parse(item.lastSeenAt) >= seenCutoff),
  );
  const items = new Map(
    (previous?.items ?? [])
      .filter((item) => Date.parse(previous?.seen[item.key]?.lastSeenAt ?? item.firstSeenAt) >= itemCutoff)
      .map((item) => [item.key, item]),
  );
  let lastIssuedAt = previous?.lastIssuedAt ?? new Date(Math.floor(nowMs / 1000) * 1000).toISOString();
  const nextDate = new Date(
    Math.max(Math.floor(nowMs / 1000) * 1000, previous ? Date.parse(lastIssuedAt) + 1000 : 0),
  ).toISOString();
  for (const item of input.items) {
    const known = seen[item.key];
    const firstSeenAt = known?.firstSeenAt ?? nextDate;
    seen[item.key] = {
      guid: known?.guid ?? item.guid,
      firstSeenAt,
      lastSeenAt: new Date(
        Math.max(nowMs, Date.parse(firstSeenAt), known ? Date.parse(known.lastSeenAt) : 0),
      ).toISOString(),
    };
    if (!known) lastIssuedAt = firstSeenAt;
    items.set(item.key, { ...item, guid: seen[item.key].guid, firstSeenAt });
  }
  return {
    title: input.title,
    language: input.language,
    link: input.link,
    lastIssuedAt,
    seen,
    items: [...items.values()].sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt) || a.key.localeCompare(b.key)),
  };
};

/** 通知日時と元記事の公開日時を区別したRSSを生成する。 */
export const buildSlackRss = (sourceUrl: string, history: SlackFeedHistory): string => {
  slackSourcePath(sourceUrl);
  const url = sourceUrl;
  const feed = new Feed({
    title: history.title,
    language: history.language,
    description: '初回掲載順の通知用RSS。元記事の公開日時は本文に記載します。',
    id: url,
    link: history.link,
    copyright: constants.feedCopyright,
    feedLinks: { rss: url, atom: url.replace(/rss\.xml$/, 'atom.xml'), json: url.replace(/rss\.xml$/, 'feed.json') },
    updated: new Date(history.lastIssuedAt),
  });
  for (const item of history.items) {
    const originalDate = new Date(item.originalPublishedAt).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour12: false,
    });
    const text = `元記事公開：${originalDate}（日本時間）\n\n${item.summary}`;
    feed.addItem({
      id: item.guid,
      guid: item.guid,
      link: item.url,
      image: item.image ? { url: item.image } : undefined,
      author: item.creator ? [{ name: item.creator }] : undefined,
      category: item.tags.map((name) => ({ name: name.replace(/</g, '&lt;').replace(/>/g, '&gt;') })),
      title: escapeHtml(item.title),
      description: escapeHtml(text),
      content: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
      published: new Date(item.firstSeenAt),
      date: new Date(item.firstSeenAt),
    });
  }
  return feed.rss2();
};
