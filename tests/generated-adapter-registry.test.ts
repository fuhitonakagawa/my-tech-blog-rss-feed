import { describe, expect, it } from 'vitest';
import { getGeneratedFeedAdapter } from '../src/feed/generated/adapter-registry';
import type { GeneratedFeedDefinition } from '../src/feed/generated/types';

const definition: GeneratedFeedDefinition = {
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
};

describe('getGeneratedFeedAdapter', () => {
  it('Serverless Operationsの記事とカテゴリーを抽出する', () => {
    const html = `
      <main>
        <div><ul><li><a href="/blog/tag/aws">#AWS</a></li></ul></div>
        <ul>
          <li>
            <a href="/blog/article-id"><h3>記事タイトル</h3></a>
            <a href="/blog/tag/aws">#AWS</a>
            <time datetime="2026-09-05"></time>
            <time datetime="12:34:56"></time>
          </li>
        </ul>
      </main>
    `;

    const items = getGeneratedFeedAdapter('serverless-operations')(definition, html);

    expect(items).toEqual([
      {
        id: 'https://serverless.co.jp/blog/article-id',
        title: '記事タイトル',
        url: 'https://serverless.co.jp/blog/article-id',
        publishedAt: '2026-09-05T03:34:56.000Z',
        summary: '',
        creator: '',
        categories: ['AWS'],
      },
    ]);
  });

  it('未登録アダプターを拒否する', () => {
    expect(() => getGeneratedFeedAdapter('unknown')).toThrow(
      '生成フィードの抽出アダプター「unknown」が登録されていません',
    );
  });
});
