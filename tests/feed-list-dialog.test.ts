import { Script } from 'node:vm';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { DISPLAY_SECTION_LIST } from '../src/resources/display-section-list';
import { renderFeedListButton, renderFeedListDialog } from '../src/site/_includes/components/feed-list-dialog';
import { feedListDialogScript } from '../src/site/_includes/components/scripts';

it('一覧の操作スクリプトをブラウザー用JavaScriptとして解釈できる', () => {
  expect(() => new Script(feedListDialogScript)).not.toThrow();
});

describe('renderFeedListButton', () => {
  it('登録フィード一覧モーダルを開くボタンを表示する', () => {
    const html = renderFeedListButton();

    expect(html).toContain('aria-label="登録フィード一覧を開く"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-controls="feed-list-dialog"');
  });
});

describe('renderFeedListDialog', () => {
  it('セクションごとの登録フィードを表示する', () => {
    const html = renderFeedListDialog({ url: '/rss/publickey/' });

    const $ = load(html);
    expect($('dialog').attr('aria-labelledby')).toBe('feed-list-dialog-title');
    expect($('dialog').is('[open]')).toBe(false);
    expect(html).toContain('登録フィード一覧');
    expect(html).toContain('Publickey');
    expect(html).toContain('https://www.publickey1.jp/atom.xml');
    expect(html).toContain('href="../../rss/publickey/"');
    expect(html).toContain('href="../../rss/ai-jp/">カテゴリページ</a>');
    expect(html).toContain('/rss/ai-jp/feeds/rss.xml');
  });

  it('利用可能な生成フィードは元ページと購読URLを表示する', () => {
    const html = renderFeedListDialog({ url: '/rss/my-tech-blog-jp/' }, new Map([['serverless-operations', 'ok']]));

    expect(html).toContain('href="https://serverless.co.jp/blog/">Serverless Operations</a>');
    expect(html).toContain(
      'https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/generated/serverless-operations/rss.xml',
    );
    expect(html).toContain('data-status="ok">正常</span>');
  });

  it('生成元の取得に失敗した場合は前回データ利用中と表示する', () => {
    const html = renderFeedListDialog({ url: '/rss/my-tech-blog-jp/' }, new Map([['serverless-operations', 'stale']]));

    expect(html).toContain('data-status="stale">前回正常データを配信中</span>');
  });

  it('RSSを生成できない生成フィードは購読リンクを表示しない', () => {
    const html = renderFeedListDialog({ url: '/rss/my-tech-blog-jp/' }, new Map());

    expect(html).not.toContain('Serverless Operations');
  });
});

describe('登録フィード一覧のカテゴリ構造', () => {
  it('全カテゴリを定義の表示順で表示し、現在のカテゴリだけ展開する', () => {
    const $ = load(renderFeedListDialog({ url: '/rss/publickey/' }, new Map()));
    const ids = $('.ui-feed-list-dialog__section')
      .toArray()
      .map((node) => $(node).attr('id'));
    expect(ids).toEqual([
      ...DISPLAY_SECTION_LIST.map(({ id }) => `feed-list-section-${id}`),
      'feed-list-section-statistics',
    ]);
    expect($('details[open]')).toHaveLength(1);
    expect($('details[open]').attr('id')).toBe('feed-list-section-publickey');
    expect($('details[open] summary').text()).toContain('取得元 1件');
    expect($('details[open] .ui-feed-list-dialog__subscription a').last().attr('href')).toContain(
      '/rss/publickey/feeds/rss.xml',
    );
    expect($('details[open] .ui-feed-list-dialog__feeds a').last().attr('href')).toBe(
      'https://www.publickey1.jp/atom.xml',
    );
  });

  it('重複除外版と中国語の日本語訳で取得元カテゴリを区別する', () => {
    const $ = load(renderFeedListDialog({ url: '/' }, new Map()));
    const dedup = $('#feed-list-section-my-tech-blog-jp-dedup');
    expect(
      dedup
        .find('.ui-feed-list-dialog__sources a')
        .toArray()
        .map((node) => $(node).text()),
    ).toEqual(['国内テックブログ', 'yamadashy企業テックブログ', 'karaageAI情報']);
    const translated = $('#feed-list-section-my-tech-blog-robotics-zh-translated-jp');
    expect(translated.text()).toContain('中国語記事の翻訳元カテゴリ');
    expect(translated.find('.ui-feed-list-dialog__sources a').text()).toBe('Robotics（中国語）');
    expect(translated.find('.ui-feed-list-dialog__feeds')).toHaveLength(0);
  });
});
