import { describe, expect, it } from 'vitest';
import { FeedCrawler } from '../src/feed/feed-crawler';
import { FEED_INFO_LIST, FEED_SECTION_LIST } from '../src/resources/feed-info-list';

// 設定のテスト
describe('FEED_INFO_LIST', () => {
  it('FEED_INFO_LIST の設定が正しい', () => {
    expect(() => {
      FeedCrawler.validateFeedInfoList(FEED_INFO_LIST);
    }).not.toThrow();
  });
});

describe('FEED_SECTION_LIST', () => {
  it('セクションIDが重複していない', () => {
    const sectionIds = FEED_SECTION_LIST.map((section) => section.id);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
  });

  it('各フィードに所属セクションのIDが設定されている', () => {
    for (const section of FEED_SECTION_LIST) {
      for (const feedInfo of section.feedInfoList) {
        expect(feedInfo.sectionId).toBe(section.id);
      }
    }
  });

  it('FEED_INFO_LIST が全セクションのフィードを網羅している', () => {
    const sectionFeedCount = FEED_SECTION_LIST.reduce((count, section) => count + section.feedInfoList.length, 0);
    expect(FEED_INFO_LIST.length).toBe(sectionFeedCount);
  });
});
