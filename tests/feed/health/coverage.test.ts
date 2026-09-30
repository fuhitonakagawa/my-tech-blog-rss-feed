import { expect, it } from 'vitest';
import { sectionFeedUrls } from '../../../src/common/constants';
import { checkFeedCoverage } from '../../../src/feed/health/coverage';
import { slackSourcePath } from '../../../src/feed/slack/config';
import { slackArticleKey, updateSlackFeed } from '../../../src/feed/slack/model';
import type { SlackFeedState } from '../../../src/feed/slack/types';
import type { DeduplicatedFeedDefinition } from '../../../src/resources/deduplicated-feed-list';
import type { TranslatedFeedDefinition } from '../../../src/resources/translated-feed-list';
import { makeSourceItem } from '../../helpers/translation-fixtures';

const translated: TranslatedFeedDefinition[] = [
  { id: 'ai-jp', title: 'AI', sourceSectionId: 'ai', sourceLanguage: 'en', targetLanguage: 'ja' },
];
const dedup: DeduplicatedFeedDefinition[] = [
  { id: 'zenn-dedup', title: 'Zenn', sourceSectionIds: ['ai'], priority: 1 },
  { id: 'my-tech-blog-jp-dedup', title: 'Company', sourceSectionIds: ['company'], priority: 0 },
];
const state = (outputs: Record<string, string[]>): SlackFeedState => ({
  schemaVersion: 1,
  updatedAt: '2026-09-30T12:00:00.000Z',
  feeds: Object.fromEntries(
    Object.entries(outputs).map(([id, urls]) => {
      const rssUrl = sectionFeedUrls(id).rss;
      return [
        slackSourcePath(rssUrl),
        updateSlackFeed(
          {
            rssUrl,
            rssPath: slackSourcePath(rssUrl),
            json: JSON.stringify({
              title: id,
              home_page_url: 'https://example.com/',
              items: urls.map((url) => ({
                id: url,
                url,
                title: 'Article',
                date_published: '2026-09-30T00:00:00.000Z',
              })),
            }),
          },
          undefined,
          new Date('2026-09-30T12:00:00.000Z'),
        ),
      ];
    }),
  ),
});

it('別dedupへの既存所属を未掲載と誤判定せず、英語だけを翻訳対象として照合する', () => {
  const a = makeSourceItem();
  const ja = makeSourceItem({ link: 'https://example.com/ja', sourceLanguage: 'ja' });
  const report = checkFeedCoverage(
    [a, a, ja],
    state({ ai: [a.link, ja.link], 'ai-jp': [a.link], 'my-tech-blog-jp-dedup': [a.link, ja.link] }),
    translated,
    dedup,
  );
  expect(report.every((check) => check.missing.length === 0)).toBe(true);
  expect(report.find((check) => check.kind === 'translated')?.expected).toBe(1);
});

it('通常・翻訳・dedupの脱落とGCPの日別フラグメントを独立して検出する', () => {
  const first = makeSourceItem({ link: 'https://cloud.google.com/release-notes#September_29_2026' });
  const second = makeSourceItem({ link: 'https://cloud.google.com/release-notes#September_30_2026' });
  const report = checkFeedCoverage(
    [first, second],
    state({ ai: [first.link], 'ai-jp': [first.link], 'zenn-dedup': [first.link] }),
    translated,
    dedup,
  );
  expect(report).toHaveLength(3);
  expect(report.every((check) => check.missing.length === 1 && check.missing[0] === slackArticleKey(second.link))).toBe(
    true,
  );
});
