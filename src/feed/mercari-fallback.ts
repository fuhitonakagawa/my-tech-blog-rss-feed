import { load } from 'cheerio';
import { removeInvalidUnicode } from './common-util';
import type { CustomRssParserFeed, CustomRssParserItem } from './feed-crawler';
import { parsePublicationDate } from './publication-metadata';
import type { SourceRequestQueue } from './source-request';

export const mercariFeedUrl = 'https://engineering.mercari.com/blog/feed.xml';
const pageUrl = 'https://engineering.mercari.com/blog/';

/** Astroの文字列値だけを読み、任意の型や実行可能なデータを復元しない。 */
const scalar = (value: unknown): string | undefined =>
  Array.isArray(value) && value[0] === 0 && typeof value[1] === 'string' ? value[1] : undefined;

/** 公式一覧の公開時刻は日本時間として解釈し、日付のみのカードを代用しない。 */
export const parseMercariIndex = (html: string): CustomRssParserFeed => {
  const $ = load(html);
  const items = new Map<string, CustomRssParserItem>();
  $('astro-island[props]').each((_, element) => {
    let props: unknown;
    try {
      props = JSON.parse($(element).attr('props') ?? '');
    } catch {
      return;
    }
    if (!props || typeof props !== 'object' || !('posts' in props)) return;
    const posts = props.posts;
    if (!Array.isArray(posts) || posts[0] !== 1 || !Array.isArray(posts[1])) return;
    for (const entry of posts[1]) {
      if (!Array.isArray(entry) || entry[0] !== 0 || !entry[1] || typeof entry[1] !== 'object') continue;
      const post = entry[1] as Record<string, unknown>;
      const slug = scalar(post.slug);
      const title = removeInvalidUnicode(scalar(post.title) ?? '').trim();
      const published = scalar(post.published);
      if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug) || !title || !published) continue;
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(published)) continue;
      const isoDate = parsePublicationDate(`${published}+09:00`);
      if (!isoDate) continue;
      const link = `${pageUrl}entry/${slug}/`;
      items.set(link, {
        link,
        guid: link,
        title,
        isoDate,
        pubDate: new Date(isoDate).toUTCString(),
        blogTitle: 'メルカリエンジニアリングブログ',
        blogLink: pageUrl,
        sectionId: '',
        sourceLanguage: 'ja',
        sourceFeedUrl: mercariFeedUrl,
      });
    }
  });
  if (!items.size) throw new Error('メルカリ公式一覧に公開日時を確認できる記事がありません');
  return { title: 'メルカリエンジニアリングブログ', link: pageUrl, sectionId: '', items: [...items.values()] };
};

/** RSS取得不能時だけ同じ公開サイトの一覧を読み、接続検証と期限を共有する。 */
export const fetchMercariFallback = async (queue: SourceRequestQueue): Promise<CustomRssParserFeed> =>
  parseMercariIndex(await queue.fetchText(pageUrl, { accept: 'text/html' }));
