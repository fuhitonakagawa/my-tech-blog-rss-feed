import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { create as createCache } from 'flat-cache';
import constants from '../common/constants';
import { isPublishableHttpUrl } from '../common/url-guard';
import type { FeedLanguage } from '../resources/feed-language';
import { removeInvalidUnicode } from './common-util';
import type { CustomRssParserFeed, CustomRssParserItem } from './feed-crawler';
import {
  boundedFeedText,
  feedItemIdentifier,
  isDeliverableIdentifier,
  normalizeFeedItemTags,
} from './feed-item-policy';
import { logger } from './logger';
import { parsePublicationDate } from './publication-metadata';
import { slackArticleKey } from './slack/model';

export interface AcquiredArticle {
  link: string;
  guid: string;
  title: string;
  isoDate: string;
  summary: string;
  creator: string;
  categories: string[];
}

interface AcquisitionSnapshot {
  sourceUrl: string;
  items: AcquiredArticle[];
}

/** 取得履歴にも、通知RSSと同じ識別子・公開URL・日時の条件を適用する。 */
export const isAcquiredArticle = (value: unknown): value is AcquiredArticle => {
  if (!value || typeof value !== 'object') return false;
  const item = value as AcquiredArticle;
  return (
    typeof item.link === 'string' &&
    isPublishableHttpUrl(item.link) &&
    typeof item.guid === 'string' &&
    isDeliverableIdentifier(item.guid) &&
    feedItemIdentifier(item.link, item.guid) === item.guid &&
    typeof item.title === 'string' &&
    item.title.length <= 2000 &&
    removeInvalidUnicode(item.title) === item.title &&
    parsePublicationDate(item.isoDate) === item.isoDate &&
    typeof item.summary === 'string' &&
    item.summary.length <= 5000 &&
    removeInvalidUnicode(item.summary) === item.summary &&
    typeof item.creator === 'string' &&
    item.creator.length <= 2000 &&
    removeInvalidUnicode(item.creator) === item.creator &&
    Array.isArray(item.categories) &&
    item.categories.every((tag) => typeof tag === 'string' && tag.length <= 2000 && removeInvalidUnicode(tag) === tag)
  );
};

/** URLの追跡情報を除き、記事を区別するフラグメントは保持する。 */
const articleKey = slackArticleKey;

const snapshotArticle = (item: CustomRssParserItem): AcquiredArticle => ({
  link: item.link,
  guid: feedItemIdentifier(item.link, item.guid),
  title: boundedFeedText(item.title ?? '', 2000),
  isoDate: item.isoDate,
  summary: boundedFeedText(item.summary || item.contentSnippet || '', 5000),
  creator: boundedFeedText(item.creator ?? '', 2000),
  categories: normalizeFeedItemTags(item.categories),
});

/** 公開成功とは独立して取得済み記事を保持し、元RSSから消えた期間内記事を補う。 */
export class AcquisitionHistory {
  constructor(
    private readonly directory = process.env.FEED_ACQUISITION_DIR ?? '.feed-acquisition',
    private readonly publishedKeys: ReadonlySet<string> = new Set(),
  ) {}

  /** 専用記録を優先し、移行時だけ旧キャッシュを読み込む。破損を初期化で隠さない。 */
  private read(sourceUrl: string, id: string): AcquisitionSnapshot | undefined {
    const file = path.join(this.directory, `${id}.json`);
    let value: unknown;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error('取得記録のファイルが不正です');
      value = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      if (fs.existsSync(path.join(this.directory, 'index.json'))) return undefined;
      value = createCache({ cacheId: id }).get('snapshot');
    }
    if (value === undefined) return undefined;
    const snapshot = value as AcquisitionSnapshot;
    if (snapshot.sourceUrl !== sourceUrl || !Array.isArray(snapshot.items) || !snapshot.items.every(isAcquiredArticle))
      throw new Error('取得記録の内容が不正です');
    return snapshot;
  }

  /** 保存失敗を伝播し、未保存の取得を成功として扱わない。 */
  private save(id: string, snapshot: AcquisitionSnapshot): void {
    fs.mkdirSync(this.directory, { recursive: true });
    const file = path.join(this.directory, `${id}.json`);
    if (!snapshot.items.length) {
      fs.rmSync(file, { force: true });
      return;
    }
    const temporary = `${file}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporary, `${JSON.stringify(snapshot)}\n`);
      fs.renameSync(temporary, file);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }

  public enrich(
    feed: CustomRssParserFeed,
    sourceUrl: string,
    seeds: readonly AcquiredArticle[] = [],
    language: FeedLanguage = feed.items[0]?.sourceLanguage ?? 'unknown',
  ): number {
    const key = createHash('sha256').update(sourceUrl).digest('hex');
    const id = `feed-acquisition-v1-${key}`;
    const previous = this.read(sourceUrl, id);
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - constants.aggregateFeedDurationInHours * 3600_000).toISOString();
    const articles = new Map<string, AcquiredArticle>();
    for (const item of previous?.items ?? []) {
      if (item.isoDate <= now && !this.publishedKeys.has(articleKey(item.link)))
        articles.set(articleKey(item.link), item);
    }
    for (const item of [...seeds, ...feed.items.map(snapshotArticle)]) {
      if (
        isAcquiredArticle(item) &&
        item.isoDate >= cutoff &&
        item.isoDate <= now &&
        !this.publishedKeys.has(articleKey(item.link))
      )
        articles.set(articleKey(item.link), item);
    }
    this.save(id, { sourceUrl, items: [...articles.values()] });
    // 未公開の取得記録は期間を過ぎても残し、元記事日時のまま通知候補へ戻す。
    for (const item of feed.items) {
      if (articles.has(articleKey(item.link))) item.recoveredUnpublished = true;
    }
    const current = new Set(feed.items.map((item) => articleKey(item.link)));
    let added = 0;
    for (const [key, item] of articles) {
      if (current.has(key)) continue;
      feed.items.push({
        ...item,
        contentSnippet: item.summary,
        pubDate: new Date(item.isoDate).toUTCString(),
        blogTitle: feed.title,
        blogLink: feed.link,
        sectionId: feed.sectionId,
        sourceLanguage: language,
        sourceFeedUrl: sourceUrl,
        recoveredUnpublished: true,
      });
      added++;
    }
    if (added) logger.info('[feed-acquisition] restored', { sourceUrl, added });
    return added;
  }
}
