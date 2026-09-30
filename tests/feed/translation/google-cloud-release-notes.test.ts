import Parser from 'rss-parser';
import { describe, expect, it } from 'vitest';
import { formatGoogleCloudReleaseNotes } from '../../../src/feed/translation/google-cloud-release-notes';
import { generateTranslatedFeeds } from '../../../src/feed/translation/translated-feed-generator';
import { makeSourceItem } from '../../helpers/translation-fixtures';

const source = () =>
  makeSourceItem({
    title: 'September 29, 2026',
    originalTitle: 'September 29, 2026',
    isoDate: '2026-09-29T07:00:00Z',
    sourceFeedUrl: 'https://cloud.google.com/feeds/gcp-release-notes.xml',
    sectionId: 'googlecloud',
    link: 'https://docs.cloud.google.com/release-notes#September_29_2026',
    content: `<h2 class="release-note-product-title">API Gateway</h2>
    <h3>Feature</h3><p>Streaming support</p>
    <h2 class="release-note-product-title">BigQuery</h2>
    <h2 class="release-note-product-title">API Gateway</h2>
    <h2 class="release-note-product-title">Cloud Interconnect</h2>
    <h2 class="release-note-product-title">Cloud SDK</h2>
    <h2>587.0.0 (2026-09-29)</h2>`,
  });

describe('Google Cloudリリースノートの翻訳表示', () => {
  it('専用見出しだけを掲載順に抽出し、本文と原文情報を保持する', () => {
    const item = source();
    const before = structuredClone(item);
    const result = formatGoogleCloudReleaseNotes(item);
    expect(result.title).toBe('Google Cloud更新：API Gateway、BigQuery、Cloud Interconnectほか（2026-09-29）');
    expect(result.summary).toBe('対象サービス：API Gateway、BigQuery、Cloud Interconnect、Cloud SDK。\n\nBuild apps');
    expect(result).toMatchObject({
      guid: item.guid,
      link: item.link,
      isoDate: item.isoDate,
      content: item.content,
      originalTitle: item.originalTitle,
    });
    expect(item).toEqual(before);
  });

  it('文字参照・空白・入れ子を正規化し、空の見出しを除く', () => {
    const result = formatGoogleCloudReleaseNotes({
      ...source(),
      content:
        '<h2 class="release-note-product-title"> A &amp; <b>B</b>\n Cloud </h2><h2 class="release-note-product-title"> </h2>',
    });
    expect(result.title).toBe('Google Cloud更新：A & B Cloud（2026-09-29）');
  });

  it.each([
    { sourceFeedUrl: 'https://cloudblog.withgoogle.com/products/gcp/rss' },
    { sourceFeedUrl: undefined },
    { content: '<h2>Unrelated heading</h2>' },
    { content: '' },
    { isoDate: 'invalid' },
  ])('対象外・情報不足の記事は通常表示を保つ: %o', (overrides) => {
    const item = { ...source(), ...overrides };
    expect(formatGoogleCloudReleaseNotes(item)).toBe(item);
  });

  it.each([false, true])('翻訳出力だけを整形し、RSS/Atom/JSONの識別子を保持する（翻訳器失敗=%s）', async (failure) => {
    const items = [
      source(),
      { ...source(), guid: 'blog', sourceFeedUrl: 'https://cloudblog.withgoogle.com/products/gcp/rss' },
    ];
    const before = structuredClone(items);
    const result = await generateTranslatedFeeds(
      items,
      [
        {
          id: 'googlecloud-translated-jp',
          title: 'Google Cloud - Translated Japanese',
          sourceSectionId: 'googlecloud',
          sourceLanguage: 'en',
          targetLanguage: 'ja',
        },
      ],
      new Map(),
      new Map(),
      () => ({
        translateItems: async (input) => {
          if (failure) throw new Error('unavailable');
          return input.map((item) => ({ ...item, title: '2026年9月29日', summary: '翻訳した概要' }));
        },
      }),
    );
    const feeds = result.get('googlecloud-translated-jp');
    const json = JSON.parse(feeds?.json ?? '');
    expect(json.items[0].title).toContain('Google Cloud更新：API Gateway');
    expect(json.items[0]._custom.originalTitle).toBe('September 29, 2026');
    expect(json.items[1].title).toBe(`${failure ? 'September 29, 2026' : '2026年9月29日'} | Source Blog`);
    expect(json.items[0].summary.split(failure ? 'Build apps' : '翻訳した概要')).toHaveLength(2);
    for (const xml of [feeds?.rss, feeds?.atom]) {
      const parsed = await new Parser().parseString(xml ?? '');
      expect(parsed.items).toHaveLength(2);
      expect(parsed.items[0].title).toContain('Google Cloud更新：API Gateway');
      expect(parsed.items[0].link).toBe(items[0].link);
      expect(new Date(parsed.items[0].isoDate ?? '').toISOString()).toBe('2026-09-29T07:00:00.000Z');
    }
    expect((await new Parser().parseString(feeds?.rss ?? '')).items[0].guid).toBe(items[0].guid);
    expect(items).toEqual(before);
  });
});
