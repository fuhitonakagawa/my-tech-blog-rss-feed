セクションは今後20，30に増えるため、URLはカテゴリごとに管理しやすく持っておきたい
デプロイはどう行える？



----


完了です。検証済み（tsc / テスト60件 / feed-generate / site-build すべて成功）。

## URL構造の変更

セクションを `/rss/` 配下に集約しました。20〜30個に増えてもルートが散らかりません。

```
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/ai/                 ← ページ
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/ai/feeds/rss.xml    ← RSS
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/engineering/
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/infra/
```

- プレフィックス `rss` は `constants.ts` の `sectionRootPath` に一元化（ページ・フィード・ナビ・alternate リンク・Eleventy 出力すべてがここを参照）
- セクションIDは `ai-rss` → `ai` のように簡潔化（`-rss` 接尾辞はパスで表現されるため不要に）
- サイトURLは実リポジトリ名に合わせて `my-tech-blog-rss-feed` に統一
- セクション追加は従来どおり `FEED_SECTION_LIST` に1エントリ追加するだけ

## デプロイ方法

デプロイの仕組みは **`.github/workflows/generate-feed.yml` に構築済み**です（main への push・定期スケジュール・手動実行のいずれかで、フィード生成 → サイトビルド → `gh-pages` ブランチへ公開）。必要な手順は：

1. **変更をコミットして main へ push**
   → push をトリガーに「Generate feeds and site」ワークフローが自動実行され、初回実行で `gh-pages` ブランチが作られます
2. **GitHub Pages を有効化**（初回のみ）
   リポジトリの Settings → Pages → Build and deployment で
   Source: **Deploy from a branch** → Branch: **gh-pages** / **(root)** を選択
3. 数分後に `https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/` で公開されます

以後の更新は自動です：
- **定期実行**: 平日8-24時は毎時、休日8-24時は2時間おき（JST）。フィードキャッシュは Actions cache で実行間引き継ぎ
- **手動実行**: Actions タブ →「Generate feeds and site」→ Run workflow（または `gh workflow run generate-feed.yml`）

注意点：
- リポジトリが **private の場合、GitHub Pages は Free プランでは使えません**（public にするか有料プランが必要）
- **60日間リポジトリに活動がないと定期実行が自動停止**します（GitHub仕様。通知メールから再有効化可能）
- フォークとして作成したリポジトリの場合、Actions タブで初回にワークフローの有効化確認が出ます

コミット・push はご指示があれば実行します。