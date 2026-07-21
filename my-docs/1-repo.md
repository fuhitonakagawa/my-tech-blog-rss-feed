このリポを理解して

-----

リポジトリを理解しました。以下にまとめます。

## 企業テックブログRSS（tech-blog-rss-feed）

### 概要
日本の**企業テックブログの更新をまとめたRSSフィード**を生成・配信する静的サイトジェネレータ。オリジナルは [yamadashy/tech-blog-rss-feed](https://github.com/yamadashy/tech-blog-rss-feed) で、[GitHub Pages](https://yamadashy.github.io/tech-blog-rss-feed/) で公開。多数の企業ブログのRSS/Atomを巡回して1つのフィード（Atom/RSS/JSON）とサイトにまとめる。

### 技術スタック
- **言語/実行**: TypeScript + Node.js >= 24（`tsx` で直接実行）
- **静的サイト生成**: [Eleventy (11ty)](https://www.11ty.dev/) v3（`*.11ty.ts` テンプレート）
- **フィード処理**: `rss-parser`（パース）、`feed`（生成）、`open-graph-scraper`（OGP取得）、`fast-xml-parser`
- **キャッシュ**: `flat-cache` + `@11ty/eleventy-fetch`
- **並列制御**: `@supercharge/promise-pool`
- **品質**: Biome（lint/format）、tsc、secretlint、Vitest（テスト）

### ディレクトリ構成
```
src/
├─ cli/          # エントリポイント（generate-feed, prune-cache, register-index, prepare-site）
├─ feed/         # 中核ロジック（crawler, generator, storer, validator, prune-cache）
├─ common/       # 定数・ユーティリティ
├─ resources/    # feed-info-list.ts ← 巡回対象ブログ一覧
└─ site/         # Eleventy テンプレート・アセット・_data
tests/           # Vitest（external/ は実ネットワークテスト）
.github/workflows/  # ci.yml, generate-feed.yml, external-test.yml
```

### 処理フロー（`npm run feed-generate`）
1. **FeedCrawler.crawlFeeds** — `FEED_INFO_LIST` の全ブログを並列（50並列）で取得
   - `flat-cache` でフィードをキャッシュ（1時間TTL）、リトライあり、XMLバリデーション
   - 記事を集計（過去8日分にフィルタ、未来日時を除外、日付ソート）、重複リンク除外
   - 各記事のOGP情報（24時間キャッシュ）とはてブ数（50件ずつAPI）を並列取得
   - ブログごとの個別調整（例: メルカリの時差9時間補正、リンク書き換え）
2. **FeedGenerator.generateFeeds** — まとめフィード（Atom/RSS/JSON）を生成
3. **FeedStorer.storeFeeds** — `src/site/feeds/` と `src/site/blog-feeds/` に出力
4. **FeedValidator** — 生成フィードをバリデーション

その後 `site-build` で Eleventy がサイトを生成。

### 運用
- GitHub Actions（`generate-feed.yml`）で定期実行：平日8-24時は1時間おき、休日は2時間おき
- 取得に継続失敗するフィードはコメントアウトして管理（直近のコミット履歴がまさにそれ）

### フィード追加ルール（CLAUDE.md 準拠）
`src/resources/feed-info-list.ts` の `FEED_INFO_LIST` に `['企業名', 'RSS URL']` を追加。ブランチ `chore/new-feed-<企業名>` を作りPRを出す流れが規定されており、**各手順は都度ユーザーの同意を得て進める**ことになっています。

何か特定の部分を深掘りしたい、あるいはフィード追加などの作業をしたい場合は教えてください。