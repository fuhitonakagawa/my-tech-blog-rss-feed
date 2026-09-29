import Parser from 'rss-parser';
import { describe, expect, it } from 'vitest';
import constants from '../../../src/common/constants';
import { slackSourcePath } from '../../../src/feed/slack/config';
import { buildSlackRss, slackArticleKey, updateSlackFeed } from '../../../src/feed/slack/model';
import type { SlackSource } from '../../../src/feed/slack/types';

const rssUrl = `${constants.siteUrl}rss/ai-jp/feeds/rss.xml`;
const article = (url: string, date = '2026-09-29T06:00:00.000Z') => ({
  id: url,
  url,
  title: '記事 & <確認>',
  summary: '内容',
  date_published: date,
});
const source = (items: ReturnType<typeof article>[]): SlackSource => ({
  rssUrl,
  rssPath: 'translated-feeds/ai-jp/feeds/rss.xml',
  json: JSON.stringify({ title: 'AI', home_page_url: `${constants.siteUrl}rss/ai-jp/`, items }),
});

describe('Slack用の初回掲載日時', () => {
  it('記事のGUID・著者・画像・カテゴリを保持する', async () => {
    const value = {
      ...article('https://example.com/article'),
      id: 'original-guid',
      author: { name: '著者' },
      image: 'https://example.com/image.png',
      tags: ['API'],
    };
    const input = source([value]);
    const history = updateSlackFeed(input, undefined, new Date('2026-09-29T07:00:00.000Z'));
    const parsed = await new Parser().parseString(buildSlackRss(rssUrl, history));
    expect(parsed.items[0].guid).toBe('original-guid');
    expect(parsed.items[0].creator).toBe('著者');
    expect(parsed.items[0].enclosure?.url).toBe(value.image);
    expect(parsed.items[0].categories).toEqual(['API']);
  });

  it.each([
    'feeds/rss.xml',
    'rss/ai/feeds/rss.xml',
    'feeds/generated/anthropic-news/rss.xml',
    'feeds/statistics/daily/rss.xml',
  ])('翻訳以外の自家製RSSでも元記事日時と通知日時を分離する: %s', async (path) => {
    const sourceUrl = `${constants.siteUrl}${path}`;
    const input = { ...source([article('https://example.com/old', '2026-09-20T00:00:00.000Z')]), rssUrl: sourceUrl };
    const history = updateSlackFeed(input, undefined, new Date('2026-09-29T07:00:00.000Z'));
    const parsed = await new Parser().parseString(buildSlackRss(sourceUrl, history));
    expect(parsed.items[0].isoDate).toBe('2026-09-29T07:00:00.000Z');
    expect(parsed.items[0].contentSnippet).toContain('2026/9/20');
    expect(parsed.items[0].link).toBe('https://example.com/old');
  });

  it('遅れて取得した過去記事も、前回の通知日時より後になる', async () => {
    const recent = article('https://example.com/recent');
    const late = article('https://example.com/late', '2026-09-28T00:00:00.000Z');
    const first = updateSlackFeed(source([recent]), undefined, new Date('2026-09-29T07:00:00.000Z'));
    const second = updateSlackFeed(source([recent, late]), first, new Date('2026-09-29T08:00:00.000Z'));
    const xml = await new Parser().parseString(buildSlackRss(rssUrl, second));
    const newlyNotified = xml.items.filter((item) => Date.parse(item.pubDate ?? '') > Date.parse(first.lastIssuedAt));
    expect(newlyNotified.map((item) => item.link)).toEqual([late.url]);
    expect(newlyNotified[0].contentSnippet).toMatch(/^元記事公開：/);
    expect(newlyNotified[0].contentSnippet).toContain('2026/9/28');
    expect(second.items.find((item) => item.url === recent.url)?.firstSeenAt).toBe(first.items[0].firstSeenAt);
    expect(second.items.find((item) => item.url === late.url)?.originalPublishedAt).toBe(late.date_published);
  });

  it('再生成や本文更新で通知日時・GUIDを変更しない', async () => {
    const input = source([article('https://example.com/article')]);
    const first = updateSlackFeed(input, undefined, new Date('2026-09-29T07:00:00.000Z'));
    const repeated = updateSlackFeed(input, first, new Date('2026-09-29T08:00:00.000Z'));
    expect(buildSlackRss(rssUrl, repeated)).toBe(buildSlackRss(rssUrl, first));
    const updated = source([{ ...article('https://example.com/article'), summary: '更新内容' }]);
    const third = updateSlackFeed(updated, repeated, new Date('2026-09-29T09:00:00.000Z'));
    const parser = new Parser();
    const before = (await parser.parseString(buildSlackRss(rssUrl, first))).items[0];
    const after = (await parser.parseString(buildSlackRss(rssUrl, third))).items[0];
    expect(after.guid).toBe(before.guid);
    expect(after.pubDate).toBe(before.pubDate);
    expect(after.contentSnippet).toContain('更新内容');
  });

  it('同じ秒に実行しても後着記事の日時を前回より進める', () => {
    const now = new Date('2026-09-29T07:00:00.123Z');
    const first = updateSlackFeed(source([article('https://example.com/one')]), undefined, now);
    const second = updateSlackFeed(source([article('https://example.com/two')]), first, now);
    expect(Date.parse(second.lastIssuedAt)).toBeGreaterThan(Date.parse(first.lastIssuedAt));
  });

  it('取得元から消えた記事を14日保持し、既知の過去記事が戻っても再通知しない', () => {
    const input = source([article('https://example.com/article')]);
    const first = updateSlackFeed(input, undefined, new Date('2026-09-01T00:00:00.000Z'));
    const missing = updateSlackFeed(source([]), first, new Date('2026-09-02T00:00:00.000Z'));
    expect(missing.items).toHaveLength(1);
    const expired = updateSlackFeed(source([]), missing, new Date('2026-09-16T00:00:00.000Z'));
    expect(expired.items).toEqual([]);
    const returned = updateSlackFeed(input, expired, new Date('2026-09-17T00:00:00.000Z'));
    expect(returned.items[0].firstSeenAt).toBe(first.items[0].firstSeenAt);
    expect(returned.lastIssuedAt).toBe(first.lastIssuedAt);
  });

  it('追跡パラメーターを識別に使わず、統計記事の日付フラグメントは区別する', () => {
    expect(slackArticleKey('https://example.com/a?utm_source=x')).toBe(slackArticleKey('https://example.com/a'));
    expect(slackArticleKey('https://example.com/stats/#2026-09-28')).not.toBe(
      slackArticleKey('https://example.com/stats/#2026-09-29'),
    );
  });

  it('自サイト以外のURLや不正な配信パスは通知用に変換しない', () => {
    expect(slackSourcePath(rssUrl)).toBe('rss/ai-jp/feeds/rss.xml');
    expect(() => slackSourcePath('https://example.com/rss.xml')).toThrow();
    expect(() => slackSourcePath(`${constants.siteUrl}../rss.xml`)).toThrow();
  });
});
