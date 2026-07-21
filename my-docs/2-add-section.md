以下のように複数のRSSをセクションごとに分けて管理できるようにしたい。

## ai-rss

https://openai.com/news/rss.xml

## engineering-rss

https://vercel.com/atom

## infra-rss

https://aws.amazon.com/blogs/compute/feed/

そして、https://fuhitonakagawa.github.io/tech-blog-rss-feed/ai-rss
のような形で管理したい

---

完了しました。lint・型チェック・テスト（60件）すべて通過し、実際に feed-generate → site-build を end-to-end で実行して動作確認済みです。

実装内容

セクション構造の導入

- src/resources/feed-info-list.ts: FEED_SECTION_LIST を新設。既存の約600件は削除し、3セクション構成に置き換え
  - ai-rss（AI）: OpenAI
  - engineering-rss（Engineering）: Vercel
  - infra-rss（Infra）: AWS Compute Blog
  - セクションIDはURLスラッグとして検証（英小文字・数字・ハイフンのみ）
  - FEED_INFO_LIST はセクションから導出されるため、クローラや既存処理はそのまま動作

フィード生成パイプライン

- feed-crawler.ts: 取得した feed / item に sectionId をタグ付け（クロールは全体で1回のまま）
- feed-generator.ts: フィードのメタ情報（title / description / pageUrl / feedUrls）を AggregatedFeedMeta として引数化し、全体まとめとセクションまとめの両方を生成可能に
- feed-storer.ts: storeSectionFeeds() を追加。src/site/section-feeds/<id>/feeds/ に出力（毎回作り直すので削除セクションの残骸が残らない）
- generate-feed-command.ts: 全体フィードに加え、セクションごとに items をフィルタして生成・出力・XMLバリデーション

サイト生成（Eleventy）

- \_data/sections.js: セクションごとの feed.json を読み、表示用チャンクと最終更新日時を構築
- section.11ty.ts: /ai-rss/ 等のページを pagination で生成（RSS URLコピー欄 + 日付ごとの記事一覧、更新なしの場合の表示あり）
- nav.ts: セクションリンクをナビに追加（アクティブ状態対応）
- main.11ty.ts: セクションページの <link rel="alternate"> がそのセクションのフィードを指すように
- sitemap には自動でセクションページが含まれます

配信URL（確認済み）

https://fuhitonakagawa.github.io/tech-blog-rss-feed/ai-rss/ ← HTMLページ
https://fuhitonakagawa.github.io/tech-blog-rss-feed/ai-rss/feeds/atom.xml
https://fuhitonakagawa.github.io/tech-blog-rss-feed/ai-rss/feeds/rss.xml
https://fuhitonakagawa.github.io/tech-blog-rss-feed/ai-rss/feeds/feed.json

constants の更新

siteUrlStem・GitHub リンク・copyright・UserAgent を fuhitonakagawa に変更し、Google Analytics 関連キー（yamadashy さんのもの）は空にしました。

1点確認: xUserUrl は https://x.com/yamadashy のまま残しています（ヘッダーのXアイコンのリンク先）。ご自身のXアカウントに変えるか、アイコン自体を消すか、指定があれば対応します。

セクション追加は今後 FEED_SECTION_LIST に createFeedSection('id', '表示名', [...]) を1つ足すだけで、ページ・フィード・ナビ・sitemap すべてに自動反映されます。

---

readmeとかかえないの？

---

lint（Biome / tsc / secretlint）すべて通過しました。ドキュメントを今回のセクション構造に合わせて更新しました。

## 更新内容

### README.md（全面改訂）

セクション対応後の仕様書として書き直しました。

- **目次 + 18セクション構成**（番号付き・絵文字見出し）
- **アーキテクチャ概要**: フィード生成パイプライン → Eleventy → GitHub Pages の mermaid 構成図
- **セクション管理（§10）**: `FEED_SECTION_LIST` の定義方法、セクションIDの制約（英小文字・数字・ハイフン）、フィード追加手順、自動反映範囲
- **配信URL / 外部インタフェース（§11)**: 全体まとめ・セクション別フィードのURL表、JSON Feed の `_custom` 拡張フィールド仕様、利用する外部API
- **処理詳細（§9）**: `feed-generate` の7ステップ（検証 → 取得 → 集約 → メタデータ → 全体+セクション別生成 → 出力 → 最終バリデーション）と `site-build` の流れ
- **プロジェクト構造**: 全ファイルの網羅的ツリー（生成物ディレクトリ `section-feeds/` 含む）
- **フローチャート・シーケンス図**: `feed-generate` の詳細フローと、定期実行〜デプロイまでのシーケンスを mermaid で記載
- サイトURL・リポジトリ参照は `fuhitonakagawa.github.io` / fork リポジトリに更新

### CLAUDE.md（`.agents/rules/base.md`、AGENTS.md も同一実体）

- **フィード追加のルール**: ヒアリング項目に「追加先のセクション」を追加し、更新先を `FEED_INFO_LIST` から `FEED_SECTION_LIST` に変更
- **セクション追加のルール**を新設: ID・表示名・所属フィードを確認して `createFeedSection` を追加するだけで、ページ・フィード・ナビ・sitemap が自動生成されることを明記

これでコードとドキュメントが一致した状態です。コミットはご指示があれば行います（グローバルルールに従い勝手には実行しません）。
