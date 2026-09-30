import { Feed, type FeedOptions } from 'feed';
import constants from '../common/constants.js';
import { isPublishableHttpUrl, isValidImageDataUrl } from '../common/url-guard';
import { removeInvalidUnicode, textToMd5Hash, textTruncate } from './common-util';
import type { CustomRssParserItem, FeedItemHatenaCountMap, OgObjectMap } from './feed-crawler';
import { feedItemIdentifier, isDeliverableIdentifier, normalizeFeedItemTags } from './feed-item-policy';
import { logger } from './logger';

export interface FeedDistributionSet {
  atom: string;
  rss: string;
  json: string;
}

/**
 * まとめフィードのメタ情報。全体まとめ・セクションまとめの双方で使用する
 */
export interface AggregatedFeedMeta {
  title: string;
  language?: string;
  description: string;
  /** フィードに対応するページのURL。末尾スラッシュ付き */
  pageUrl: string;
  feedUrls: {
    atom: string;
    rss: string;
    json: string;
  };
}

export interface GenerateFeedResult {
  aggregatedFeed: Feed;
  feedDistributionSet: FeedDistributionSet;
}
/**
 * XML 向けのエスケープ。
 * feed ライブラリ（v6）はテキストノード・URL・属性値の `&` は自前でエスケープするが、
 * 属性値の `<` `>`（category の term / label）と enclosure の alt はエスケープしないので、そこだけ補う。
 * title / description / content は CDATA（Atom では type="html"）として出力されるので、
 * HTML として正しくなるようこちらでエスケープする。
 */
const escapeTextForXml = (text: string) => {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const escapeAngleBrackets = (text: string) => {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

/**
 * RSS / Atomの本文はHTML、JSONのタイトル・概要はプレーンテキストとして配信する。
 * AtomのIDは公開URL、RSS / JSONのIDは元のGUIDを使用する。
 */
type FeedTextFormat = 'rss' | 'atom' | 'json';

interface PreparedFeedItem {
  id: string;
  title: string;
  description: string;
  content: string;
  link: string;
  categories: string[];
  creator?: string;
  image?: { url: string; alt?: string; type?: string; length?: number };
  date: Date;
  hatenaCount: number;
  originalTitle: string;
  translatedTitle?: string;
  blogTitle: string;
  blogLink: string;
  favicon?: string;
}

export class FeedGenerator {
  public generateFeeds(
    feedItems: CustomRssParserItem[],
    feedItemOgObjectMap: OgObjectMap,
    allFeedItemHatenaCountMap: FeedItemHatenaCountMap,
    maxFeedDescriptionLength: number,
    maxFeedContentLength: number,
    feedMeta: AggregatedFeedMeta,
  ): GenerateFeedResult {
    const preparedFeedItems = this.prepareFeedItems(
      feedItems,
      feedItemOgObjectMap,
      allFeedItemHatenaCountMap,
      maxFeedDescriptionLength,
      maxFeedContentLength,
    );

    // XML と JSON でテキストのエスケープ方法が違うので、それぞれ別の Feed を組み立てる
    const rssFeed = this.createFeed(preparedFeedItems, 'rss', feedMeta);
    const atomFeed = this.createFeed(preparedFeedItems, 'atom', feedMeta);
    const jsonFeed = this.createFeed(preparedFeedItems, 'json', feedMeta);

    logger.info('[create-feed] finished');

    return {
      aggregatedFeed: rssFeed,
      feedDistributionSet: {
        atom: atomFeed.atom1(),
        rss: rssFeed.rss2(),
        json: jsonFeed.json1(),
      },
    };
  }

  private prepareFeedItems(
    feedItems: CustomRssParserItem[],
    feedItemOgObjectMap: OgObjectMap,
    allFeedItemHatenaCountMap: FeedItemHatenaCountMap,
    maxFeedDescriptionLength: number,
    maxFeedContentLength: number,
  ): PreparedFeedItem[] {
    const preparedFeedItems: PreparedFeedItem[] = [];

    for (const feedItem of feedItems) {
      logger.info('[create-feed-item]', feedItem.isoDate, feedItem.title);

      // 公開できる記事URLを持つ項目だけを配信する。
      if (!isPublishableHttpUrl(feedItem.link)) {
        logger.warn('[feed-item] フィードのリンクが不正です。', feedItem.link, feedItem.title);
        continue;
      }
      const feedItemId = feedItemIdentifier(feedItem.link, feedItem.guid);
      if (!isDeliverableIdentifier(feedItemId)) continue;
      const feedItemContent = (feedItem.summary || feedItem.contentSnippet || '').replace(/(\n|\t+|\s+)/g, ' ');

      const ogObject = feedItemOgObjectMap.get(feedItem.link);
      const ogImage = ogObject?.customOgImage;
      const feedItemImage = ogImage?.url && isPublishableHttpUrl(ogImage.url) ? { ...ogImage } : undefined;

      // 日付がないものは入れない
      if (!feedItem.isoDate) {
        logger.warn('[feed-item] フィードの日付がありません。', feedItem.isoDate, feedItem.title);
        continue;
      }

      preparedFeedItems.push({
        id: feedItemId,
        // 「記事タイトル | ブログ名」の形にする。タイトルだけでどの企業かわかるように
        title: `${feedItem.title} | ${feedItem.blogTitle}`,
        description: textTruncate(feedItemContent, maxFeedDescriptionLength),
        content: textTruncate(feedItemContent, maxFeedContentLength),
        link: feedItem.link,
        categories: normalizeFeedItemTags(feedItem.categories),
        creator: feedItem.creator && typeof feedItem.creator === 'string' ? feedItem.creator : undefined,
        image: feedItemImage,
        date: new Date(feedItem.isoDate),
        hatenaCount: allFeedItemHatenaCountMap.get(feedItem.link) || 0,
        originalTitle: feedItem.originalTitle ?? feedItem.title ?? '',
        ...(feedItem.originalTitle !== undefined ? { translatedTitle: feedItem.title ?? '' } : {}),
        blogTitle: feedItem.blogTitle,
        blogLink: feedItem.blogLink,
        favicon:
          ogObject?.favicon && (isPublishableHttpUrl(ogObject.favicon) || isValidImageDataUrl(ogObject.favicon))
            ? ogObject.favicon
            : undefined,
      });
    }

    return preparedFeedItems;
  }

  private createFeed(
    preparedFeedItems: PreparedFeedItem[],
    textFormat: FeedTextFormat,
    feedMeta: AggregatedFeedMeta,
  ): Feed {
    const escapeText = textFormat !== 'json' ? escapeTextForXml : (text: string) => text;
    const escapeCategory = textFormat !== 'json' ? escapeAngleBrackets : (text: string) => text;

    const outputFeed = new Feed({
      title: feedMeta.title,
      description: feedMeta.description,
      language: feedMeta.language ?? constants.feedLanguage,
      id: feedMeta.pageUrl,
      link: feedMeta.pageUrl,
      feedLinks: feedMeta.feedUrls,
      image: `${constants.siteUrlStem}/images/icon.png`,
      favicon: `${constants.siteUrlStem}/images/favicon.ico`,
      copyright: constants.feedCopyright,
      generator: constants.feedGenerator,
      updated: new Date(),
    } as FeedOptions);

    for (const preparedFeedItem of preparedFeedItems) {
      // alt は RSS の enclosure 属性にそのまま出るので常にエスケープする（JSON Feed には出ない）
      const image = preparedFeedItem.image
        ? {
            ...preparedFeedItem.image,
            alt: preparedFeedItem.image.alt && escapeTextForXml(removeInvalidUnicode(preparedFeedItem.image.alt)),
          }
        : undefined;

      outputFeed.addItem({
        id:
          textFormat === 'atom' && !isPublishableHttpUrl(preparedFeedItem.id)
            ? preparedFeedItem.link
            : preparedFeedItem.id,
        guid: preparedFeedItem.id,
        title: escapeText(preparedFeedItem.title),
        description: escapeText(preparedFeedItem.description),
        // content は Atom / RSS / JSON Feed（content_html）のいずれでも HTML なので常にエスケープする
        content: escapeTextForXml(preparedFeedItem.content),
        link: preparedFeedItem.link,
        category: preparedFeedItem.categories.map((category) => {
          return {
            name: escapeCategory(category),
          };
        }),
        author: preparedFeedItem.creator ? [{ name: preparedFeedItem.creator }] : undefined,
        image,
        published: preparedFeedItem.date,
        date: preparedFeedItem.date,
        extensions: [
          {
            name: '_custom',
            // サイト表示用。feed.json から読むのでエスケープしない（XML 側ではライブラリがエスケープする）
            objects: {
              hatenaCount: preparedFeedItem.hatenaCount,
              originalTitle: preparedFeedItem.originalTitle,
              ...(preparedFeedItem.translatedTitle !== undefined
                ? { translatedTitle: preparedFeedItem.translatedTitle }
                : {}),
              blogTitle: preparedFeedItem.blogTitle,
              blogLink: preparedFeedItem.blogLink,
              blogLinkMd5Hash: textToMd5Hash(preparedFeedItem.blogLink),
              favicon: preparedFeedItem.favicon,
            },
          },
        ],
      });
    }

    return outputFeed;
  }
}
