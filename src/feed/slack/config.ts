import constants from '../../common/constants';

export const slackFeedConfig = {
  itemRetentionDays: 14,
  seenRetentionDays: 90,
  maxStateBytes: 64 * 1024 * 1024,
};

/** 自サイトが生成するRSSだけを通知用フィードへ対応付ける。 */
export const slackSourcePath = (rssUrl: string): string => {
  if (!rssUrl.startsWith(constants.siteUrl)) throw new Error('Slack用RSSの取得元が自サイトではありません');
  const path = rssUrl.slice(constants.siteUrl.length);
  if (
    !/^(?:feeds\/rss\.xml|rss\/[a-z0-9-]+\/feeds\/rss\.xml|feeds\/generated\/[a-z0-9-]+\/rss\.xml|feeds\/statistics\/daily\/rss\.xml)$/.test(
      path,
    )
  ) {
    throw new Error('Slack用RSSの取得元パスが不正です');
  }
  return path;
};

/** 公開URLに対応するローカル出力先だけを許可する。 */
export const validateRssOutputPath = (rssUrl: string, output: string): void => {
  const published = slackSourcePath(rssUrl);
  if (published.startsWith('rss/') && !/^(section-feeds|translated-feeds|deduplicated-feeds)\//.test(output))
    throw new Error('カテゴリRSSの出力ディレクトリが不正です');
  const local = output.replace(/^(?:section-feeds|translated-feeds|deduplicated-feeds)\//, 'rss/');
  if (local !== published) throw new Error('RSSの出力先が公開URLに対応していません');
};
