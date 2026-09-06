import { Feed, type FeedOptions } from 'feed';
import constants, { generatedFeedUrls } from '../../common/constants';
import { textTruncate } from '../common-util';
import type { FeedDistributionSet } from '../feed-generator';
import type { GeneratedFeedDefinition, GeneratedFeedItem } from './types';

const GENERATED_FEED_SUMMARY_MAX_LENGTH = 500;

/** 生成元ごとのRSS・Atom・JSON Feedを作成する */
export const buildGeneratedFeed = (
  definition: GeneratedFeedDefinition,
  items: GeneratedFeedItem[],
  contentUpdatedAt: string,
): FeedDistributionSet => {
  const feedUrls = generatedFeedUrls(definition.id);
  const feed = new Feed({
    title: definition.label,
    description: `${definition.label}の更新情報`,
    language: definition.language,
    id: definition.pageUrl,
    link: definition.pageUrl,
    feedLinks: feedUrls,
    copyright: constants.feedCopyright,
    generator: constants.feedGenerator,
    updated: new Date(contentUpdatedAt),
  } as FeedOptions);

  for (const item of items) {
    const summary = textTruncate(item.summary, GENERATED_FEED_SUMMARY_MAX_LENGTH);
    feed.addItem({
      id: item.id,
      guid: item.id,
      title: item.title,
      link: item.url,
      description: summary,
      content: summary,
      category: item.categories.map((category) => ({ name: category })),
      author: item.creator ? [{ name: item.creator }] : undefined,
      published: new Date(item.publishedAt),
      date: new Date(item.publishedAt),
    });
  }

  return {
    atom: feed.atom1(),
    rss: feed.rss2(),
    json: feed.json1(),
  };
};
