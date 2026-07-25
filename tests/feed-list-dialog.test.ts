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
});
