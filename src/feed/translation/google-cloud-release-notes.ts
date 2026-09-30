import { load } from 'cheerio';
import { removeInvalidUnicode } from '../common-util';
import type { CustomRssParserItem } from '../feed-crawler';

/** リリースノートのサービス見出しだけを、掲載順・重複なしで返す。 */
const releaseProducts = (html: string): string[] => {
  const document = load(html);
  document('script, style').remove();
  return [
    ...new Set(
      document('h2.release-note-product-title')
        .toArray()
        .map((element) => removeInvalidUnicode(document(element).text()).replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    ),
  ];
};

/** 日本語派生の対象RSSだけにサービス一覧を付け、識別子と原文情報を保持する。 */
export const formatGoogleCloudReleaseNotes = (item: CustomRssParserItem): CustomRssParserItem => {
  if (item.sourceFeedUrl !== 'https://cloud.google.com/feeds/gcp-release-notes.xml') return item;
  const products = releaseProducts(item.content || '');
  const date = new Date(item.isoDate);
  if (products.length === 0 || !Number.isFinite(date.getTime())) return item;
  const names = products.slice(0, 3).join('、') + (products.length > 3 ? 'ほか' : '');
  const summary = `対象サービス：${products.join('、')}。\n\n${item.summary || item.contentSnippet || ''}`;
  return {
    ...item,
    title: `Google Cloud更新：${names}（${date.toISOString().slice(0, 10)}）`,
    summary,
    contentSnippet: summary,
  };
};
