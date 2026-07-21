このpagesの更新の仕組みは？都度新規ブランチにrss情報を静的に取ってきてファイル化しているの？

仕組みを整理すると：**「都度、実行時にRSSを取得して静的ファイル化 → `gh-pages` ブランチを毎回丸ごと上書き」**です。新規ブランチは作らず、main にも生成物はコミットしません。

## 更新フロー（`.github/workflows/generate-feed.yml`）

```
トリガー: 定期実行（平日8-24時は毎時 / 休日は2時間おき, JST）+ main への push + 手動実行
    │
    ▼ ubuntu ランナー上で毎回ゼロから実行
1. main を checkout
2. Actions cache からフィード・OGPキャッシュを復元（restore-feed-cache）
3. cache-prune          … 14日以上古いキャッシュを削除
4. feed-generate        … ★ここで全RSSをライブ取得
      → src/site/feeds/ , src/site/section-feeds/ , src/site/blog-feeds/ に
        XML/JSON をファイル出力（すべて .gitignore 対象。gitには入らない）
5. site-prepare / site-build … Eleventy が public/ に静的サイト一式を生成
6. Actions cache へキャッシュ保存（save-feed-cache）
7. peaceiris/actions-gh-pages が public/ を gh-pages ブランチへ push
      → force_orphan: true なので毎回履歴を破棄して1コミットで上書き
    │
    ▼
GitHub Pages が gh-pages ブランチを配信
```

## ポイント

- **RSS取得は毎回ビルド時**: 取得結果はワークスペース内の一時ファイルであり、main には一切コミットされません。「静的に取ってきてファイル化」は正しいですが、その置き場は git ではなく**ビルド成果物（`public/`）→ `gh-pages` ブランチ**です
- **`gh-pages` は履歴なしの使い捨て**: `force_orphan: true` により毎回全消し・全置換。ブランチは常に1コミットだけで、リポジトリサイズが肥大化しません
- **実行間で引き継ぐのは git ではなく Actions cache**: フィードXML（TTL 1時間）・OGP（24時間）・画像バッファをキャッシュし、毎時実行でも外部リクエストを最小化します。キャッシュが効くため、1時間以内の再実行では大半のフィードは再取得されません
- **失敗時は前回の配信が残る**: デプロイはビルド成功時のみ走るので、途中で失敗しても Pages は最後に成功した状態を配信し続けます（先ほどの guid エラーで落ちていた間もサイト自体は生きていました）
- **同時実行の抑制**: `concurrency: generate-feed` + `cancel-in-progress: true` で、連続 push 時は古い実行が自動キャンセルされます（先ほど「cancelled」になっていたのはこれ）

つまり「フィードの状態」は git で管理せず、**毎回フルビルドの純粋な静的サイト生成 + 上書きデプロイ**という構成です。