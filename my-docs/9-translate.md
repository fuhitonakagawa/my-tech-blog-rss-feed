以下の設計で、英語RSSを日本語に翻訳して1本のRSS feedをgenerateする機能を追加します

設計書は以下です
my-docs/10-translate-design.md

---

実装と内部検証まで進んでいます。

- 12カテゴリの翻訳フィード、キャッシュ、原文へのフォールバック
- TypeScript 251件・Python 11件のテスト成功
- lint・型検査・脆弱性監査成功
- フォールバック時の全体生成・サイトビルド成功

**最終の実翻訳・品質確認は、ライセンス例外の承認待ちです。**
間接依存の **certifi・tqdm（MPLを含む）、udtools・udapi（GPLを含む）** の利用を許可しますか？

確認理由は、[AGENTS.md](/Users/fuhitonakagawa/my-tech-blog-rss-feed/AGENTS.md)の「非コピーレフトライセンスのみ。それ以外はユーザーに確認する」という指定です。

---

src/resources/generated-feeds
には翻訳後の各カテゴリENマージフィードURLは出ないの？

---

そこは**HTMLからRSSを作る生成元の定義置き場**です。翻訳後のカテゴリ統合フィードは、別の定義からセクションフィードとして出力します。

AI-JPの場合は次の構成です。

| 用途                   | 場所                                         |
| ---------------------- | -------------------------------------------- |
| 翻訳対象カテゴリの定義 | `src/resources/translated-sections.json`     |
| 生成されたRSS          | `src/site/section-feeds/ai-jp/feeds/rss.xml` |
| 配信用ファイル         | `public/rss/ai-jp/feeds/rss.xml`             |
| 公開パス               | `/rss/ai-jp/feeds/rss.xml`                   |

AWS-JPなども同様です。派生RSSを取得元に登録すると自サイトを再取得してしまうため、`src/resources/generated-feeds/`への登録は不要です。

なお、現在のローカル出力は原文フォールバックの検証結果で、実翻訳の最終確認はライセンス承認待ちです。

---

sections/ に入るということ？
そこだと生RSSを流しているだけのカテゴリとごっちゃになるから、
翻訳feed用の別のディレクトリにしたほうがよくない？

---

翻訳用の専用ディレクトリに分けました。

```text
src/resources/
├── sections/          通常RSSのカテゴリ定義
├── generated-feeds/   HTMLからのRSS生成定義
└── translated-feeds/  翻訳統合フィードの定義
```

例：[ai-jp.json](/Users/fuhitonakagawa/my-tech-blog-rss-feed/src/resources/translated-feeds/ai-jp.json)

生成物も`src/site/translated-feeds/`へ分離しています。公開URLは`/rss/ai-jp/feeds/rss.xml`のままです。

252件のテストとビルドは成功しました。実翻訳の最終検証は、引き続きライセンス承認待ちです。
