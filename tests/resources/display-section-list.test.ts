import { describe, expect, it } from 'vitest';
import { DEDUPLICATED_FEED_DEFINITION_LIST } from '../../src/resources/deduplicated-feed-list';
import { DISPLAY_SECTION_LIST } from '../../src/resources/display-section-list';
import { TRANSLATED_FEED_DEFINITION_LIST } from '../../src/resources/translated-feed-list';

const ids = DISPLAY_SECTION_LIST.map(({ id }) => id);

describe('カテゴリの表示順', () => {
  it('重複除外版の集約元を直後にひとまとまりで表示する', () => {
    for (const definition of DEDUPLICATED_FEED_DEFINITION_LIST) {
      const start = ids.indexOf(definition.id) + 1;
      expect(ids.slice(start, start + definition.sourceSectionIds.length)).toEqual(definition.sourceSectionIds);
    }
  });

  it('各日本語訳を原文の直後に表示する', () => {
    for (const definition of TRANSLATED_FEED_DEFINITION_LIST) {
      expect(ids[ids.indexOf(definition.sourceSectionId) + 1]).toBe(definition.id);
    }
  });

  it('Zenn・QiitaのPhysical AIを各サービスのAIに続ける', () => {
    for (const service of ['zenn', 'qiita']) {
      expect(ids[ids.indexOf(`${service}-ai`) + 1]).toBe(`${service}-physical-ai`);
    }
  });
});
