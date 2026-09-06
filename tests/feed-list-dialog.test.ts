import { describe, expect, it } from 'vitest';
import { renderFeedListButton, renderFeedListDialog } from '../src/site/_includes/components/feed-list-dialog';

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

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('登録フィード一覧');
    expect(html).toContain('Publickey');
    expect(html).toContain('https://www.publickey1.jp/atom.xml');
    expect(html).toContain('href="../../rss/publickey/"');
  });

  it('利用可能な生成フィードは元ページと購読URLを表示する', () => {
    const html = renderFeedListDialog({ url: '/rss/jp-tech-blog/' }, new Map([['serverless-operations', 'ok']]));

    expect(html).toContain('href="https://serverless.co.jp/blog/">Serverless Operations</a>');
    expect(html).toContain(
      'https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/generated/serverless-operations/rss.xml',
    );
    expect(html).toContain('data-status="ok">正常</span>');
  });

  it('生成元の取得に失敗した場合は前回データ利用中と表示する', () => {
    const html = renderFeedListDialog({ url: '/rss/jp-tech-blog/' }, new Map([['serverless-operations', 'stale']]));

    expect(html).toContain('data-status="stale">前回正常データを配信中</span>');
  });

  it('RSSを生成できない生成フィードは購読リンクを表示しない', () => {
    const html = renderFeedListDialog({ url: '/rss/jp-tech-blog/' }, new Map());

    expect(html).not.toContain('Serverless Operations');
  });
});
