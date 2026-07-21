import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { to } from 'await-to-js';
import { textToMd5Hash, textTruncate } from './common-util';
import type { CustomRssParserFeed, FeedItemHatenaCountMap, OgObjectMap } from './feed-crawler';
import type { FeedDistributionSet } from './feed-generator';
import { logger } from './logger';

export interface BlogFeed {
  title: string;
  link: string;
  linkMd5Hash: string;
  ogImageUrl: string;
  ogDescription: string;
  items: {
    title: string;
    link: string;
    summary: string;
    content_html: string;
    isoDate: string;
    hatenaCount: number;
    ogImageUrl: string;
  }[];
}

export class FeedStorer {
  public async storeFeeds(
    feedDistributionSet: FeedDistributionSet,
    storeArticleDirPath: string,
    feeds: CustomRssParserFeed[],
    ogObjectMap: OgObjectMap,
    allFeedItemHatenaCountMap: FeedItemHatenaCountMap,
    storeBlogDirPath: string,
  ): Promise<void> {
    const [errorStoreFeed] = await to(
      Promise.all([
        this.storeArticleFeeds(feedDistributionSet, storeArticleDirPath),
        this.storeBlogFeeds(feeds, ogObjectMap, allFeedItemHatenaCountMap, storeBlogDirPath),
      ]),
    );
    if (errorStoreFeed) {
      throw new Error('ファイル出力に失敗しました', {
        cause: errorStoreFeed,
      });
    }
  }

  /**
   * セクションごとのまとめフィードを `<出力先>/<セクションID>/feeds/` に出力する。
   * 出力先ディレクトリは毎回作り直し、削除されたセクションの残骸が残らないようにする
   */
  public async storeSectionFeeds(
    sectionFeedDistributionSets: Map<string, FeedDistributionSet>,
    storeDirPath: string,
  ): Promise<void> {
    await fs.rm(storeDirPath, { recursive: true, force: true });

    for (const [sectionId, feedDistributionSet] of sectionFeedDistributionSets) {
      await this.storeArticleFeeds(feedDistributionSet, path.join(storeDirPath, sectionId, 'feeds'));
    }

    logger.info('[store-section-feeds] finished');
  }

  private async storeArticleFeeds(feedDistributionSet: FeedDistributionSet, storeDirPath: string): Promise<void> {
    await fs.mkdir(storeDirPath, { recursive: true });
    await fs.writeFile(path.join(storeDirPath, 'atom.xml'), feedDistributionSet.atom, 'utf-8');
    await fs.writeFile(path.join(storeDirPath, 'rss.xml'), feedDistributionSet.rss, 'utf-8');
    await fs.writeFile(path.join(storeDirPath, 'feed.json'), feedDistributionSet.json, 'utf-8');

    logger.info('[store-feeds] finished');
  }

  private async storeBlogFeeds(
    feeds: CustomRssParserFeed[],
    ogObjectMap: OgObjectMap,
    allFeedItemHatenaCountMap: FeedItemHatenaCountMap,
    storeDirPath: string,
  ): Promise<void> {
    await fs.rm(storeDirPath, { recursive: true, force: true });
    await fs.mkdir(storeDirPath, { recursive: true });

    const blogFeeds: BlogFeed[] = [];

    for (const feed of feeds) {
      const customFeed: BlogFeed = {
        title: feed.title,
        link: feed.link,
        linkMd5Hash: textToMd5Hash(feed.link),
        ogImageUrl: ogObjectMap.get(feed.link)?.customOgImage?.url || '',
        ogDescription: ogObjectMap.get(feed.link)?.ogDescription || '',
        items: [],
      };

      for (const feedItem of feed.items) {
        const feedItemContent = (feedItem.summary || feedItem.contentSnippet || '').replace(/(\n|\t+|\s+)/g, ' ');
        customFeed.items.push({
          title: feedItem.title || '',
          summary: textTruncate(feedItemContent, 200),
          content_html: textTruncate(feedItemContent, 1000),
          link: feedItem.link,
          isoDate: feedItem.isoDate,
          hatenaCount: allFeedItemHatenaCountMap.get(feedItem.link) || 0,
          ogImageUrl: ogObjectMap.get(feedItem.link)?.customOgImage?.url || '',
        });
      }

      blogFeeds.push(customFeed);
    }

    await fs.writeFile(path.join(storeDirPath, 'blog-feeds.json'), JSON.stringify(blogFeeds, null, 2), 'utf-8');

    logger.info('[store-blog-feeds] finished');
  }
}
