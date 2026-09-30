import Parser from 'rss-parser';
import { describe, expect, it } from 'vitest';
import { sectionFeedUrls, sectionPageUrl } from '../../src/common/constants';
import { type CustomRssParserFeed, FeedCrawler } from '../../src/feed/feed-crawler';
import { FeedGenerator } from '../../src/feed/feed-generator';
import { buildSlackRss, updateSlackFeed } from '../../src/feed/slack/model';
import type { SlackSource } from '../../src/feed/slack/types';
import { updateStatistics } from '../../src/feed/statistics/aggregate';
import { collectTranslatedStatisticsItems } from '../../src/feed/statistics/translated-items';
import { generateTranslatedFeeds } from '../../src/feed/translation/translated-feed-generator';
import type { FeedInfo } from '../../src/resources/feed-info-list';
import type { TranslatedFeedDefinition } from '../../src/resources/translated-feed-list';

const pageUrl = 'https://docs.cloud.google.com/release-notes';
const dates = ['September_29_2026', 'September_28_2026'];
const feedInfo: FeedInfo = {
  label: 'Google Cloud Release Notes',
  url: 'https://cloud.google.com/feeds/gcp-release-notes.xml',
  sectionId: 'google-cloud',
  language: 'en',
  input: { kind: 'remote', url: 'https://cloud.google.com/feeds/gcp-release-notes.xml' },
};
const definition: TranslatedFeedDefinition = {
  id: 'google-cloud-jp',
  title: 'Google Cloud - Translated Japanese',
  sourceSectionId: 'google-cloud',
  sourceLanguage: 'en',
  targetLanguage: 'ja',
};

/** 日別エントリーを持つAtomを通常のクローラー補正へ渡す。 */
const readReleaseNotes = async (): Promise<CustomRssParserFeed> => {
  const entries = dates.map(
    (date, index) => `<entry>
    <title>${date}</title><id>tag:google.com,2016:gcp-release-notes#${date}</id>
    <updated>2026-09-${29 - index}T00:00:00-07:00</updated>
    <link rel="alternate" href="${pageUrl}?utm_source=rss#${date}"/>
    <content type="html">Feature ${date}</content>
  </entry>`,
  );
  const parsed = await new Parser().parseString(`<feed xmlns="http://www.w3.org/2005/Atom">
    <title>Google Cloud Release Notes</title><id>${pageUrl}</id>
    <link href="${pageUrl}"/>${entries.join('')}</feed>`);
  const crawler = FeedCrawler as unknown as {
    postProcessFeed(info: FeedInfo, feed: CustomRssParserFeed): CustomRssParserFeed;
  };
  return crawler.postProcessFeed(feedInfo, parsed as CustomRssParserFeed);
};

describe('リリースノートの日別記事識別', () => {
  it('通常・翻訳の通知RSSで日別記事を配信し、再生成でGUIDと通知日時を維持する', async () => {
    const feed = await readReleaseNotes();
    const links = dates.map((date) => `${pageUrl}#${date}`);
    expect(feed.items.map((item) => item.link)).toEqual(links);
    const original = new FeedGenerator().generateFeeds(feed.items, new Map(), new Map(), 200, 500, {
      title: 'Google Cloud',
      description: 'Google Cloud',
      pageUrl: sectionPageUrl(feedInfo.sectionId),
      feedUrls: sectionFeedUrls(feedInfo.sectionId),
    }).feedDistributionSet;
    const translated = await generateTranslatedFeeds(feed.items, [definition], new Map(), new Map(), () => ({
      translateItems: async (items) =>
        items.map((item) => ({ ...item, originalTitle: item.title, title: `翻訳:${item.title}` })),
    }));
    for (const [id, distribution] of [['google-cloud', original], ...translated] as const) {
      const source: SlackSource = {
        rssUrl: sectionFeedUrls(id).rss,
        rssPath: `section-feeds/${id}/feeds/rss.xml`,
        json: distribution.json,
      };
      const previous = updateSlackFeed(
        {
          ...source,
          json: JSON.stringify({
            title: id,
            home_page_url: sectionPageUrl(id),
            items: [
              {
                id: pageUrl,
                url: pageUrl,
                title: '日別アンカーのない記事',
                date_published: '2026-09-28T07:00:00.000Z',
              },
            ],
          }),
        },
        undefined,
        new Date('2026-09-28T08:00:00.000Z'),
      );
      const first = updateSlackFeed(source, previous, new Date('2026-09-30T03:00:00.000Z'));
      const rss = await new Parser().parseString(buildSlackRss(source.rssUrl, first));
      const newItems = rss.items.filter((item) => Date.parse(item.isoDate ?? '') > Date.parse(previous.lastIssuedAt));
      expect(newItems.map((item) => item.link).sort()).toEqual([...links].sort());
      expect(new Set(newItems.map((item) => item.guid)).size).toBe(2);
      expect(newItems.every((item) => item.isoDate === '2026-09-30T03:00:00.000Z')).toBe(true);
      const repeat = updateSlackFeed(source, first, new Date('2026-09-30T04:00:00.000Z'));
      expect(buildSlackRss(source.rssUrl, repeat)).toBe(buildSlackRss(source.rssUrl, first));
    }
  });

  it('日次統計と翻訳掲載照合で異なる日付の記事を混同しない', async () => {
    const { items } = await readReleaseNotes();
    const translated = collectTranslatedStatisticsItems(
      items,
      [definition],
      new Map([
        [
          definition.id,
          {
            rss: '',
            atom: '',
            json: JSON.stringify({ items: [{ url: items[0].link }] }),
          },
        ],
      ]),
    );
    expect(translated).toEqual([items[0]]);
    const sections = [{ id: feedInfo.sectionId, title: 'Google Cloud', feedInfoList: [feedInfo] }];
    const initial = updateStatistics(null, [], sections, new Date('2026-09-27T15:00:00.000Z'));
    const result = updateStatistics(
      initial,
      items,
      sections,
      new Date('2026-09-29T15:00:00.000Z'),
      [definition],
      translated,
    );
    expect(new Set(result.observations.map((item) => item.articleId)).size).toBe(2);
    expect(result.reports.map((report) => report.categories.find((item) => item.kind === 'source')?.count)).toEqual([
      1, 1,
    ]);
    expect(result.reports.map((report) => report.categories.find((item) => item.kind === 'translated')?.count)).toEqual(
      [1, 0],
    );
  });
});
