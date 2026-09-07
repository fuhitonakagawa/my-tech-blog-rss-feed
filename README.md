# <img src="src/site/images/icon-transparent.png" height=26> 企業テックブログRSS
企業のテックブログの更新をまとめたRSSフィードを配信しています。
記事を読んでその企業の技術・カルチャーを知れることや、質の高い技術情報を得られることを目的としています。

https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/

このリポジトリは [yamadashy/tech-blog-rss-feed](https://github.com/yamadashy/tech-blog-rss-feed) のフォークです。

AIエージェント向けの継続指示とプロジェクト固有ナレッジは [AGENTS.md](AGENTS.md) を参照してください。


## セクション
フィードはセクション（カテゴリ）ごとに分けて管理しており、セクションごとのページとRSSフィードを配信しています。

- `https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/<セクションID>/` ... セクションのページ
- `https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/<セクションID>/feeds/rss.xml` ... セクションのRSSフィード（atom.xml / feed.json もあり）

## サイト追加の方針
企業のテックブログ（技術ブログ、エンジニアブログ）であれば、基本的には追加します。
ただし、以下に該当するものは検討します。

- その企業の取り組みでないものが多く投稿される可能性があるブログ
  - テック系メディア
  - Qiita Organization や Zenn Publication など、組織として投稿しているかの線引が曖昧なものは、投稿内容を見て検討します
- 記事が自社製品の紹介のみ

逆に、以下はテックブログと判断して追加しています。

- [Zenn](https://zenn.dev/), [note](https://note.com/), [Medium](https://medium.com/) などの企業系テックブログ
- 企業系ブログのテクノロジーカテゴリ

## サイトの追加方法
[src/resources/sections/](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/tree/main/src/resources/sections) でセクションごとのJSONファイルで管理しており、その一覧にない場合 issue を作っていただければ対応します。

### AIエージェントによるフィードの追加

Claude Code, Cursor, Codex, Copilot Agent などを利用して、フィードの追加からプルリク作成まで自動で行うことができます。

1. このリポジトリをフォーク
2. 以下のようにAIエージェントに送り、そのまま指示に従ってください。
  ```
  フィードを追加したい
  ```

### プルリクでの送り方
もしプルリクを送っていただける場合は以下のように作成できます。

1. このリポジトリをフォーク
2. ブランチ作成
   `git checkout -b new-blog-feed-xxx`
3. フィードを追加
   `src/resources/sections/<セクションID>.json` の `feeds` を更新
4. コミット
   `git commit -am 'chore(feed): <企業名など> 追加`
5. プッシュ
   `git push origin new-blog-feed-xxx`
6. プルリクを作成

### RSS非対応ページ

RSSまたはAtomを配信していないブログは、`src/resources/generated-feeds/<生成フィードID>.json` に生成元を定義できます。生成フィードIDは英小文字・数字・ハイフンのみ使用できます。

```json
{
  "schemaVersion": 1,
  "label": "Serverless Operations",
  "pageUrl": "https://serverless.co.jp/blog/",
  "language": "ja",
  "extractor": {
    "type": "adapter",
    "name": "serverless-operations"
  },
  "pollIntervalMinutes": 60,
  "maxItems": 50
}
```

- `schemaVersion`: 設定形式。`1`のみ使用可能
- `label`: フィード名
- `pageUrl`: 記事一覧を取得する公開ページ
- `language`: フィードの言語
- `extractor`: `css`または登録済みの`adapter`による記事抽出設定
- `pollIntervalMinutes`: 前回確認から再取得まで空ける最小時間
- `maxItems`: 前回正常時と今回取得した記事を統合した後の保持上限

`css`方式では、`itemSelector`、`titleSelector`、`linkSelector`、`dateSelector`、`timeZoneOffset`が必須です。日時や概要などを属性・別要素から取得する場合は、`dateAttribute`、`timeSelector`、`timeAttribute`、`summarySelector`、`categorySelector`、`creatorSelector`を指定できます。

セクションへの所属は、`src/resources/sections/<セクションID>.json`の`feeds`で生成フィードIDを参照します。

```json
{
  "generatedFeedId": "serverless-operations"
}
```

生成元ごとに次のURLを配信します。

- `https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/generated/<生成フィードID>/rss.xml`
- `https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/generated/<生成フィードID>/atom.xml`
- `https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/generated/<生成フィードID>/feed.json`
- `https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/generated/<生成フィードID>/snapshot.json`
- `https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/generated/<生成フィードID>/status.json`

記事IDには追跡用クエリを除いた元記事URLを使用し、公開日時は元ページから取得します。必須項目、公開日時、公開可能なURLを取得できない記事は除外し、実行時刻で補うことはありません。取得済み記事と今回の記事は記事IDで統合され、タイトルなどの現在値は今回取得した内容を使用します。

通信エラー、HTML解析エラー、記事0件の場合は前回正常時の配信内容を維持します。前回正常時の内容がない場合は購読ファイルを出力せず、フィード一覧にも購読リンクを表示しません。設定形式の不正、未定義IDの参照、未登録アダプターの参照はビルドエラーです。

前回正常時の記事状態は公開済みサイトから復元し、Actions Cacheを副経路として使用します。公開する状態ファイルには記事の公開情報だけを含め、認証情報や秘密情報は保存しません。

生成元ページはHTMLレスポンス、5 MiB以下、1回の確認につき1ページを対象とします。記事URLは公開可能なHTTPまたはHTTPSに限定します。

## 開発

### 仕組み
GitHub Actions で定期的に更新されており、サイトの生成は [Eleventy](https://www.11ty.dev/) を使用しています。

更新は多少遅延ありますが以下のタイミングで行います。
- 平日 8時-24時の1時間おき
- 休日 8時-24時の2時間おき

### フォークして使う場合
以下を書き換えると独自のサイトが動きます。

- `src/common/constants.ts` の URL など
- `src/resources/sections/` のセクション・ブログ情報

特定のブログに絞ったり、以下のように全く違ったフィードを作るもの良いと思います。

- [MATLAB-blog-rss-feed](https://github.com/minoue-xx/MATLAB-blog-rss-feed) ... MATLAB/Simulink 関連ブログの更新をまとめたRSSフィードを配信

### 開発環境とコマンド
環境
- Node.js >= 24

パッケージのインストール
```bash
$ npm install
```

フィード生成とサイト立ち上げ
```bash
$ # フィードを取得して作成
$ npm run feed-generate

$ # localhost:8080 で確認
$ npm run site-serve
```

コードのチェック
```bash
$ # Biome, tsc --noEmit, secretlint
$ npm run lint

$ # テスト
$ npm run test
```

## ライセンス
MIT
