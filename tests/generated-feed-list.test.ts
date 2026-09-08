import { describe, expect, it } from 'vitest';
import {
  GENERATED_FEED_DEFINITION_LIST,
  GENERATED_FEED_DEFINITION_MAP,
  parseGeneratedFeedDefinition,
} from '../src/resources/generated-feed-list';

describe('GENERATED_FEED_DEFINITION_LIST', () => {
  it('Serverless Operationsの生成元定義を読み込む', () => {
    expect(GENERATED_FEED_DEFINITION_LIST).toContainEqual({
      id: 'serverless-operations',
      schemaVersion: 1,
      label: 'Serverless Operations',
      pageUrl: 'https://serverless.co.jp/blog/',
      language: 'ja',
      extractor: {
        type: 'adapter',
        name: 'serverless-operations',
      },
      pollIntervalMinutes: 60,
      maxItems: 50,
    });
  });

  it('IDから同じ定義を参照できる', () => {
    const definition = GENERATED_FEED_DEFINITION_MAP.get('serverless-operations');

    expect(definition?.label).toBe('Serverless Operations');
  });

  it('未対応のスキーマバージョンを拒否する', () => {
    expect(() =>
      parseGeneratedFeedDefinition('test.json', 'test', {
        schemaVersion: 2,
      }),
    ).toThrow('schemaVersion は 1 を指定してください');
  });

  it('URLスラッグに使えないIDを拒否する', () => {
    expect(() => parseGeneratedFeedDefinition('test.json', '../test', {})).toThrow(
      '生成フィードID「../test」は英小文字・数字・ハイフンのみ使用できます',
    );
  });

  it('不正なCSS抽出設定を拒否する', () => {
    expect(() =>
      parseGeneratedFeedDefinition('test.json', 'test', {
        schemaVersion: 1,
        label: 'テスト',
        pageUrl: 'https://example.com/',
        language: 'ja',
        extractor: {
          type: 'css',
          itemSelector: 'article',
          titleSelector: 'h2',
          linkSelector: 'a',
          dateSelector: 'time',
          timeAttribute: 'datetime',
          timeZoneOffset: '+09:00',
        },
        pollIntervalMinutes: 60,
        maxItems: 50,
      }),
    ).toThrow('extractor.timeAttribute には timeSelector が必要です');
  });

  it('0以下の保持件数を拒否する', () => {
    expect(() =>
      parseGeneratedFeedDefinition('test.json', 'test', {
        schemaVersion: 1,
        label: 'テスト',
        pageUrl: 'https://example.com/',
        language: 'ja',
        extractor: {
          type: 'adapter',
          name: 'serverless-operations',
        },
        pollIntervalMinutes: 60,
        maxItems: 0,
      }),
    ).toThrow('maxItems は正の整数で指定してください');
  });

  it('認証情報を含む生成元URLを拒否する', () => {
    expect(() =>
      parseGeneratedFeedDefinition('test.json', 'test', {
        schemaVersion: 1,
        label: 'テスト',
        pageUrl: 'https://user:password@example.com/',
        language: 'ja',
        extractor: {
          type: 'adapter',
          name: 'serverless-operations',
        },
        pollIntervalMinutes: 60,
        maxItems: 50,
      }),
    ).toThrow('pageUrl が不正です');
  });
});
