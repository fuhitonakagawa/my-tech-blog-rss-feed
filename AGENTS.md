# AGENTS.md

## 適用規則

- 作業ブランチは原則として`main`を使用する。フィード追加やセクション追加のために新規ブランチを作成しない。
- ユーザーから別ブランチを明示された場合は、その指示を優先する。
- `git add`、`git commit`、`git push`は行わない。Git操作はユーザーが担当する。
- ユーザーから実装・変更を依頼された場合は、原則として確認のために作業を止めず、リポジトリ、対象URL、既存データから必要な情報を調査し、妥当な前提を置いて実装と検証まで進める。
- 複数の選択肢で成果物が大きく変わる場合、破壊的操作、権限や認証情報が必要な場合、ユーザーにしか決められない情報が不足する場合だけ質問する。
- 推測で補える名称、ID、表示順、既存パターン、技術的詳細は自分で判断する。採用した重要な前提は作業結果とともに簡潔に伝える。
- 企業名・ブログ名、URL、追加先が会話から確定できる場合は、同じ情報を聞き直さない。

## 実装規則

- 関数は小さく保ち、1つの関数に1つの責務を持たせる。
- 既存の構成、命名、型、テストのパターンを踏襲する。
- 未使用コード、互換目的の残骸、コメントアウトコード、到達不能分岐を残さない。
- TypeScriptの入出力に型を付け、`any`を安易に使用しない。
- 依存ライブラリは完全一致バージョンで管理する。
- MIT、Apache、BSD、ISCなどの非コピーレフトライセンスだけを追加できる。
- 外部入力由来のURL、HTML、XML、JSONは利用前に検証する。

## コメントとドキュメント

- コメントとDocstringは日本語で記載する。
- 目的、仕様、入力、出力、挙動、制約、例外処理、セキュリティを記載する。
- 実装の進捗、変更履歴、日付、相対時制、リポジトリ外の資料への参照を記載しない。
- 使用しなくなった処理を説明するコメントを残さない。

## 通常RSSの登録

RSSまたはAtomを配信しているサイトは、`src/resources/sections/<セクションID>.json`の`feeds`へ登録する。

```json
{
  "label": "フィード名",
  "url": "https://example.com/feed.xml"
}
```

登録前に確認する項目は次のとおり。

- 企業名またはブログ名
- RSSフィードURL
- 所属セクション
- 同一URLと同一ラベルが未登録であること
- URLを取得してXMLとして解析できること
- フィードに記事が含まれること

## セクション定義

セクションは`src/resources/sections/<セクションID>.json`に1ファイルで定義する。

- セクションIDは英小文字・数字・ハイフンだけを使用する。
- `title`はナビゲーション、見出し、フィードタイトルに使用する。
- `order`は小さい順に表示され、原則として10刻みの未使用値を使用する。
- `feeds`には通常RSSまたは生成フィード参照を指定する。
- セクションページ、RSS、Atom、JSON Feed、ナビゲーション、サイトマップは定義から生成されるため、個別ページを作成しない。

```json
{
  "order": 360,
  "title": "表示名",
  "feeds": []
}
```

## RSS非対応ページ

### 生成元

RSS非対応ページは`src/resources/generated-feeds/<生成フィードID>.json`に1サイト1ファイルで定義する。ファイル名が生成フィードIDになる。

```json
{
  "schemaVersion": 1,
  "label": "ブログ名",
  "pageUrl": "https://example.com/blog/",
  "language": "ja",
  "extractor": {
    "type": "adapter",
    "name": "adapter-name"
  },
  "pollIntervalMinutes": 60,
  "maxItems": 50
}
```

- 生成フィードIDは英小文字・数字・ハイフンだけを使用する。
- `extractor.type`は`css`または`adapter`を使用する。
- 通常のHTML構造はCSSセレクターをJSONに記載する。
- 固有構造は`src/feed/generated/adapter-registry.ts`の許可リストへアダプターを登録する。
- JSONからJavaScriptや任意ファイルパスを実行しない。
- 生成元定義にセクションIDを持たせない。

### セクションへの所属

生成フィードの所属はセクション側だけで管理する。

```json
{
  "generatedFeedId": "generated-feed-id"
}
```

- 同じ生成フィードを複数セクションへ所属させない。
- 未定義ID、重複ラベル、重複URL、未登録アダプターはビルドエラーとして扱う。

### 配信と内部入力

生成フィードは次のパスで配信する。

```text
/feeds/generated/<生成フィードID>/rss.xml
/feeds/generated/<生成フィードID>/atom.xml
/feeds/generated/<生成フィードID>/feed.json
/feeds/generated/<生成フィードID>/snapshot.json
/feeds/generated/<生成フィードID>/status.json
```

- 公開RSSと内部集約は同一実行で生成した同じXMLを使用する。
- 自サイトの公開RSS URLをHTTPで再取得しない。
- `FeedCrawler`には`generatedFeedId`をキーにした内部レジストリからXMLを渡す。
- 生成RSSは既存RSSと同じXML検証、解析、集約経路へ渡す。

### 記事と状態

- 記事IDには正規化した元記事URLを使用する。
- 識別に必要なクエリは保持し、UTMなどの追跡用パラメーターだけを除去する。
- 公開日時は元ページから取得し、取得できない場合に実行時刻を設定しない。
- 必須情報が不正な記事は除外し、有効記事が0件なら生成元全体を異常として扱う。
- 前回正常記事と今回記事をIDで統合し、今回取得した値を優先する。
- 公開日時、記事IDの順で安定して並べ、`maxItems`まで保持する。
- フィード内容が同じ場合は内容更新日時を変更しない。
- 通信・抽出エラー時は前回正常状態を使用し、状態を`stale`にする。
- 前回正常状態がない場合はRSSを出力せず、フィード一覧にも購読リンクを表示しない。
- 前回状態は公開済み`gh-pages`を主経路、Actions Cacheを副経路として復元する。

### 安全性と上限

- HTML取得には`publicNetworkDispatcher`を使用し、公開インターネット以外への接続を拒否する。
- 取得タイムアウトを設定する。
- HTMLレスポンスは5 MiB以下に制限する。
- 1回の確認で扱う一覧ページは1ページとする。
- 記事URLは公開可能なHTTPまたはHTTPSだけを使用する。
- 認証情報、署名、秘密情報を含むURLを公開物や状態ファイルへ保存しない。
- 状態ファイルには元記事の公開情報だけを保存する。

## 固定定義

### Serverless Operations

- 生成フィードID: `serverless-operations`
- 生成元: `src/resources/generated-feeds/serverless-operations.json`
- ページURL: `https://serverless.co.jp/blog/`
- 抽出方式: `serverless-operations`アダプター
- 所属セクション: `jp-tech-blog`（国内テックブログ）
- 公開RSS: `/feeds/generated/serverless-operations/rss.xml`

### 自動運転ラボ

- セクションID: `autonomous-driving`
- 表示名: `自動運転`
- 表示順: `360`
- フィード名: `自動運転ラボ`
- RSS URL: `https://jidounten-lab.com/feed/`
- 定義: `src/resources/sections/autonomous-driving.json`

## 検証

変更内容に応じて、少なくとも次を実行する。

```bash
npm run test-coverage
npm run lint
npm audit --audit-level=moderate
```

フィード追加では対象RSSを実際に取得して解析する。生成フィードでは、対象サイトを使う外部テスト、単独RSS、内部レジストリ、所属セクションを確認する。

サイト全体は次の処理順序で確認する。

```bash
npm run feed-generate
npm run site-prepare
npm run site-build
```

外部サイトの403、429、画像取得失敗は既存の許容動作として個別に記録される。プロセスの終了コード、生成フィード、対象セクションの出力を分けて判断する。

## GitHub Actionsと公開確認

- 更新ワークフローは`.github/workflows/generate-feed.yml`を使用する。
- buildジョブは読み取り権限、deployジョブだけが書き込み権限を持つ。
- push後はbuildとdeployの両方が成功するまで確認する。
- deploy成功後もGitHub Pagesの反映に遅延があり得るため、対象URLがHTTP 200になり、XMLを解析できるまで確認する。
- 生成フィードでは`status.json`の`state`、記事数、最新記事URL、フィード一覧の状態表示も確認する。
