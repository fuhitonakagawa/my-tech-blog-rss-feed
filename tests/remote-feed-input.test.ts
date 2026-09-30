import RssParser from 'rss-parser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedValidator } from '../src/feed/feed-validator';
import { logger } from '../src/feed/logger';
import { parseRemoteFeed } from '../src/feed/remote-feed-input';

const item = (id: string, fields = '<description>正常な概要</description>'): string =>
  `<item><title>記事${id}</title><link>https://example.com/${id}</link><guid>${id}</guid><pubDate>Tue, 29 Sep 2026 10:00:00 GMT</pubDate>${fields}</item>`;
const rss = (items: string): string =>
  `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>配信元</title><link>https://example.com/</link><description>配信元の概要</description>${items}</channel></rss>`;
const parse = (xml: string) => parseRemoteFeed(xml, new RssParser(), '配信元');

beforeEach(() => vi.spyOn(logger, 'warn').mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());

describe('外部RSSの破損した表示項目', () => {
  it.each(['not-a-date', ' ', '2026-02-30T00:00:00Z', '2026-13-01T00:00:00Z'])(
    'Atomの不正日時の記事だけを隔離し前後の記事のID・日時を保持する: %s',
    async (date) => {
      const entry = (id: string, dates: string): string =>
        `<entry><title>${id}</title><id>${id}</id><link href="https://example.com/${id}"/>${dates}</entry>`;
      for (const field of ['published', 'updated']) {
        const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Source</title><id>source</id>${entry('before', '<updated>2026-09-28T10:00:00Z</updated>')}${entry('bad', `<${field}>${date}</${field}>`)}${entry('after', '<updated>2026-09-29T10:00:00Z</updated>')}</feed>`;
        const result = await parse(xml);
        expect(result.feed.items.map((item) => [item.link, item.isoDate])).toEqual([
          ['https://example.com/before', '2026-09-28T10:00:00.000Z'],
          ['https://example.com/after', '2026-09-29T10:00:00.000Z'],
        ]);
        expect((await parse(result.xml)).feed.items).toEqual(result.feed.items);
      }
    },
  );

  it('日時が欠落したAtom記事に取得日時を捏造せず、内部の不正日時は拒否する', async () => {
    const xml =
      '<feed xmlns="http://www.w3.org/2005/Atom"><title>Source</title><entry><title>Missing</title><id>missing</id></entry></feed>';
    expect((await parse(xml)).feed.items[0].isoDate).toBeUndefined();
    await expect(
      new FeedValidator().assertXmlFeed('internal', xml.replace('</entry>', '<updated>bad</updated></entry>')),
    ).rejects.toThrow();
    await expect(
      parse(xml.replace('</entry>', '<updated>bad</updated><summary>&unknown;</summary></entry>')),
    ).rejects.toThrow();
  });
  it.each(['\u0000', '\u000B', '\u007F', '\u0085', '\u009F', '\uFFFD', '&#127;', '&#x7F;'])(
    '概要の破損を除いて記事URL・GUID・日時と他の記事を保持する: %j',
    async (bad) => {
      const input = rss(item('bad', `<description>PDFの文字化け${bad}内容</description>`) + item('good'));
      const { xml, feed } = await parse(input);
      expect(feed.items).toHaveLength(2);
      expect(feed.items[0]).toMatchObject({
        title: '記事bad',
        link: 'https://example.com/bad',
        guid: 'bad',
        isoDate: '2026-09-29T10:00:00.000Z',
      });
      expect(feed.items[0].contentSnippet ?? '').toBe('');
      expect(feed.items[1].contentSnippet).toBe('正常な概要');
      await expect(new FeedValidator().assertXmlFeed('output', xml)).resolves.toBeDefined();
      expect(logger.warn).toHaveBeenCalledWith(
        '[feed-input] repaired',
        expect.objectContaining({ clearedDescriptions: 1, droppedItems: 0 }),
      );
    },
  );

  it('CDATA内の壊れた本文とHTML文字参照を隔離する', async () => {
    const input = rss(
      item(
        'bad',
        '<description><![CDATA[<p>文字化け&#127;</p>]]></description><content:encoded><![CDATA[PDF\u007F本文]]></content:encoded>',
      ),
    );
    const { feed } = await parse(input);
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].contentSnippet ?? '').toBe('');
    expect(feed.items[0]['content:encoded'] ?? '').toBe('');
  });

  it('正常なHTML・改行・タブ・日本語・絵文字・クエリを変更しない', async () => {
    const input = rss(item('good', '<description><![CDATA[<p>日本語 😀 &amp; &#128512;\n\t正常</p>]]></description>'));
    const result = await parse(input);
    expect(result.xml).toBe(input);
    expect(result.feed.items[0].contentSnippet).toContain('日本語 😀 & 😀');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('タイトルの制御文字だけを除き、空になったタイトルの記事は除外する', async () => {
    const input = rss(item('a').replace('記事a', '記\u007F事a') + item('b').replace('記事b', '\u007F') + item('c'));
    const result = await parse(input);
    expect(result.feed.items.map((entry) => entry.title)).toEqual(['記事a', '記事c']);
  });

  it.each([
    '<link>https://example.com/a\u007Fb</link>',
    '<link>https://example.com/a\nb</link>',
    '<link>https://example.com/a&#x9;b</link>',
    '<guid>original\u007F-id</guid>',
    '<guid>original&#127;-id</guid>',
    '<enclosure url="https://example.com/a&#127;.png"/>',
    '<category>壊れた\u0085分類</category>',
  ])('識別情報や未対応項目の破損は該当記事だけ除外する: %j', async (field) => {
    const result = await parse(rss(item('bad', field) + item('good')));
    expect(result.feed.items.map((entry) => entry.link)).toEqual(['https://example.com/good']);
    expect(logger.warn).toHaveBeenCalledWith('[feed-input] repaired', expect.objectContaining({ droppedItems: 1 }));
  });

  it('AtomのsummaryとXHTML contentも記事単位で補正する', async () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>配信元</title><id>https://example.com/</id>
      <entry><title>記事</title><id>https://example.com/a</id><link href="https://example.com/a"/>
        <updated>2026-09-29T10:00:00Z</updated><summary>概要\u007F</summary>
        <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>PDF\u0085</p></div></content></entry>
      <entry><title>不正URL</title><id>https://example.com/b</id><link href="https://example.com/b&#127;"/></entry></feed>`;
    const result = await parse(xml);
    expect(result.feed.items).toHaveLength(1);
    expect(result.feed.items[0].link).toBe('https://example.com/a');
    expect(result.feed.items[0].contentSnippet ?? '').toBe('');
  });

  it('RSS 1.0のRDF itemの概要破損も隔離する', async () => {
    const xml = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
      <channel rdf:about="https://example.com/"><title>配信元</title><link>https://example.com/</link></channel>
      <item rdf:about="https://example.com/a"><title>記事</title><link>https://example.com/a</link><description>概要\u007F</description></item></rdf:RDF>`;
    const result = await parse(xml);
    expect(result.feed.items).toHaveLength(1);
    expect(result.feed.items[0].link).toBe('https://example.com/a');
  });

  it('RDFの壊れた記事とその参照だけを除外し、他の記事を保持する', async () => {
    const xml = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
      <channel rdf:about="https://example.com/"><title>配信元</title><link>https://example.com/</link><items><rdf:Seq>
        <rdf:li rdf:resource="https://example.com/bad\u007F"/><rdf:li rdf:resource="https://example.com/good"/>
      </rdf:Seq></items></channel>
      <item rdf:about="https://example.com/bad\u007F"><title>破損記事</title><link>https://example.com/bad\u007F</link></item>
      <item rdf:about="https://example.com/good"><title>正常記事</title><link>https://example.com/good</link></item></rdf:RDF>`;
    const result = await parse(xml);
    expect(result.feed.items.map((entry) => entry.link)).toEqual(['https://example.com/good']);
    expect(result.xml).not.toContain('bad');
  });

  it.each([
    '<rss><channel><item></channel></rss>',
    rss(item('a', '<description>&unknown;</description>')),
    rss(item('a', '<description>&#0;</description>')),
    rss(item('a')).replace('<title>配信元</title>', '<title>配信元</title><unknown>\u007F</unknown>'),
    rss(item('a')).replace('<link>https://example.com/</link>', '<link>https://exa\nmple.com/</link>'),
    '<html><body>RSSではないページ</body></html>',
    '%PDF-1.7 binary data',
  ])('XML構造・文字参照・配信元メタデータの破損を補正で隠さない: %j', async (xml) => {
    await expect(parse(xml)).rejects.toThrow();
  });

  it('空のRSSは正常に解析でき、記事URLを失った場合の数も残す', async () => {
    expect((await parse(rss(''))).feed.items).toEqual([]);
    const result = await parse(rss(item('bad', '<guid>\u007F</guid>')));
    expect(result.feed.items).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith('[feed-input] repaired', expect.objectContaining({ droppedItems: 1 }));
  });
});
