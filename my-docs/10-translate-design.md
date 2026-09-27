
# 英語RSS日本語翻訳・カテゴリ統合フィード生成 設計書

## 1. 目的

`fuhitonakagawa/my-tech-blog-rss-feed` に登録されている英語RSS / Atom / Generated Feedを対象に、

1. 既存の英語ソースを取得する
2. 記事タイトルおよびRSS内の概要文を日本語へ翻訳する
3. カテゴリ単位で複数ソースをマージする
4. 公開日時順に並べる
5. `AI-JP`、`AWS-JP` などの日本語翻訳済み統合Feedとして配信する

機能を追加する。

既存のRSS / Atom / JSON Feedは変更せず、**翻訳版を派生Feedとして追加する**。

翻訳基盤については、初期実装では外部API料金が発生しない **Argos Translate** を利用する。

Argos TranslateでEnd-to-Endの動作を成立させた後、実際のRSSを一定期間利用して翻訳品質を評価する。

翻訳品質、特に技術用語・製品名・短い記事タイトルの自然さに不満がある場合のみ、Azure AI Translator、Google Cloud Translation等のクラウド翻訳APIへ移行できる構造とする。

---

# 2. 最重要要件

この機能は、

```text
RSSごとに日本語版RSSを生成する
```

ものではない。

正しくは、

```text
カテゴリ
  ↓
カテゴリ内の英語Feedをすべて取得
  ↓
各記事の title / summary を日本語化
  ↓
記事を1つの集合へマージ
  ↓
公開日時順に並べる
  ↓
カテゴリにつき日本語版Feedを1本生成
```

である。

具体例:

```text
AIカテゴリ 20 Feed
↓
AI-JP 1 Feed

AWSカテゴリ 英語44 Feed
↓
AWS-JP 1 Feed

Databaseカテゴリ 14 Feed
↓
Database-JP 1 Feed
```

---

# 3. 完成イメージ

AIカテゴリの場合:

```text
OpenAI News ───────────────┐
OpenAI Developers ─────────┤
Anthropic Newsroom ─────────┤
Claude Announcements ───────┤
Claude Code Blog ────────────┤
Google Developers ───────────┤
Google Research ──────────────┤
Google AI ────────────────────┤
DeepMind ─────────────────────┤
Meta Engineering ─────────────┤
Microsoft Research ───────────┤
Apple ML Research ────────────┤
NVIDIA ───────────────────────┤
Hugging Face ─────────────────┤
BAIR ─────────────────────────┤
Stanford AI Lab ──────────────┤
Lil'Log ──────────────────────┤
Learning and Control ─────────┤
TalkRL ───────────────────────┤
Brain Inspired ───────────────┘
              │
              ▼
         FeedCrawler
              │
              ▼
       AIカテゴリ記事集合
              │
              ▼
       TranslationService
              │
              ▼
       日本語化済み記事集合
              │
              ▼
       FeedGenerator
              │
              ▼
            AI-JP
```

---

# 4. 生成対象

以下の翻訳版統合Feedを生成する。

| Source section | Derived feed ID | Feed title |
|---|---|---|
| `ai` | `ai-jp` | `AI-JP` |
| `aws` | `aws-jp` | `AWS-JP` |
| `azure` | `azure-jp` | `Azure-JP` |
| `google-cloud` | `google-cloud-jp` | `Google Cloud-JP` |
| `db` | `db-jp` | `Database-JP` |
| `engineering` | `engineering-jp` | `Engineering-JP` |
| `platform` | `platform-jp` | `Platform-JP` |
| `programming` | `programming-jp` | `Programming-JP` |
| `robotics` | `robotics-jp` | `Robotics-JP` |
| `security-advisory` | `security-advisory-jp` | `Security Advisory-JP` |
| `security` | `security-jp` | `Security-JP` |
| `techcrunch` | `techcrunch-jp` | `TechCrunch-JP` |

---

# 5. 出力URL

既存Section Feedと同じ構造を利用する。

AI:

```text
/rss/ai-jp/feeds/rss.xml
/rss/ai-jp/feeds/atom.xml
/rss/ai-jp/feeds/feed.json
```

AWS:

```text
/rss/aws-jp/feeds/rss.xml
/rss/aws-jp/feeds/atom.xml
/rss/aws-jp/feeds/feed.json
```

完全URL例:

```text
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/ai-jp/feeds/rss.xml
```

他カテゴリも同様。

---

# 6. Feedの意味

`AI-JP` は、

> AIカテゴリ内の英語Feedの記事だけを対象に、記事タイトルとRSS内概要を日本語へ翻訳し、それらを1本に統合したFeed

とする。

既存の日本語Feedを混ぜない。

例えばAWSカテゴリには日本語版AWS公式ブログも存在するが、

```text
AWS日本語公式Feed
```

は `AWS-JP` には含めない。

`AWS-JP` は、

```text
AWS英語Feed
↓
日本語翻訳
↓
マージ
```

した記事だけで構成する。

---

# 7. 翻訳対象フィールド

翻訳するのは以下のみ。

```text
title

summary
または
contentSnippet
```

現在の `FeedGenerator` が利用している、

```ts
feedItem.summary || feedItem.contentSnippet || ''
```

と同じ内容を翻訳する。

## 翻訳しないフィールド

以下は原文情報を維持する。

```text
link
guid
published
isoDate
author / creator
category
blogTitle
blogLink
OG image
favicon
Hatena count
```

ブログ名・サービス名まで日本語化しない。

例えば、

```text
Introducing Claude Opus 5.5 | Anthropic Newsroom
```

は、

```text
Claude Opus 5.5を発表 | Anthropic Newsroom
```

のようにする。

---

# 8. 原文タイトルの保持

翻訳後も英語原文タイトルを保持する。

`CustomRssParserItem` に、

```ts
originalTitle?: string;
```

を追加する。

翻訳時:

```ts
const translatedItem = {
  ...originalItem,
  originalTitle: originalItem.title,
  title: translatedTitle,
};
```

`FeedGenerator` の `_custom.originalTitle` は、

```ts
originalTitle:
  feedItem.originalTitle ??
  feedItem.title ??
  ''
```

とする。

---

# 9. 翻訳対象Feedの識別

## Remote Feed

`src/resources/sections/*.json` の対象Feedへ、

```json
{
  "label": "OpenAI News",
  "url": "https://openai.com/news/rss.xml",
  "language": "en"
}
```

のように `language` を追加する。

型:

```ts
export type FeedLanguage =
  | 'ja'
  | 'en'
  | 'mixed'
  | 'unknown';
```

既存Feedとの互換性を維持するため、

```text
language未指定
→ unknown
```

とする。

翻訳対象は、

```text
language === "en"
```

のみ。

`mixed` と `unknown` は今回翻訳しない。

---

# 10. Generated Feed

Generated Feedには既に、

```json
"language": "en"
```

が存在する。

例えば、

```text
anthropic-news
claude-announcements
claude-code-blog
```

は既存の `language` をそのまま使用する。

Remote FeedとGenerated Feedの言語情報は、最終的に `FeedInfo.language` へ統一する。

---

# 11. FeedInfo / FeedItem

`FeedInfo`:

```ts
export interface FeedInfo {
  label: string;
  url: ValidUrl;
  sectionId: string;
  pageUrl?: ValidUrl;
  language: FeedLanguage;
  input: FeedInput;
}
```

`CustomRssParserItem`:

```ts
export type CustomRssParserItem = RssParser.Item & {
  link: string;
  isoDate: string;
  blogTitle: string;
  blogLink: string;
  sectionId: string;

  sourceLanguage: FeedLanguage;

  originalTitle?: string;
};
```

Crawlerで、

```text
FeedInfo.language
↓
FeedItem.sourceLanguage
```

へ伝播する。

---

# 12. 翻訳版Section定義

例えば、

```text
src/resources/translated-sections.json
```

を追加する。

```json
[
  {
    "id": "ai-jp",
    "title": "AI-JP",
    "sourceSectionId": "ai",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  },
  {
    "id": "aws-jp",
    "title": "AWS-JP",
    "sourceSectionId": "aws",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  },
  {
    "id": "azure-jp",
    "title": "Azure-JP",
    "sourceSectionId": "azure",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  },
  {
    "id": "google-cloud-jp",
    "title": "Google Cloud-JP",
    "sourceSectionId": "google-cloud",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  },
  {
    "id": "db-jp",
    "title": "Database-JP",
    "sourceSectionId": "db",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  },
  {
    "id": "engineering-jp",
    "title": "Engineering-JP",
    "sourceSectionId": "engineering",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  },
  {
    "id": "platform-jp",
    "title": "Platform-JP",
    "sourceSectionId": "platform",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  },
  {
    "id": "programming-jp",
    "title": "Programming-JP",
    "sourceSectionId": "programming",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  },
  {
    "id": "robotics-jp",
    "title": "Robotics-JP",
    "sourceSectionId": "robotics",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  },
  {
    "id": "security-advisory-jp",
    "title": "Security Advisory-JP",
    "sourceSectionId": "security-advisory",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  },
  {
    "id": "security-jp",
    "title": "Security-JP",
    "sourceSectionId": "security",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  },
  {
    "id": "techcrunch-jp",
    "title": "TechCrunch-JP",
    "sourceSectionId": "techcrunch",
    "sourceLanguage": "en",
    "targetLanguage": "ja"
  }
]
```

---

# 13. 翻訳エンジン方針

## 基本方針

翻訳処理は特定Providerへ依存させない。

共通Interfaceを定義する。

```ts
export interface Translator {
  readonly id: string;

  translateMany(
    texts: string[],
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<string[]>;
}
```

`TranslationService` はこのInterfaceだけを見る。

したがって、

```text
Argos Translate
Azure AI Translator
Google Cloud Translation
DeepL
```

をFeed処理を変更せず差し替え可能にする。

---

# 14. 初期Provider: Argos Translate

## 採用理由

初期実装では **Argos Translate** を使用する。

目的は、

```text
API利用料金 0円
外部翻訳APIへの依存なし
文字数課金なし
```

でまず機能全体を成立させることである。

Argos TranslateはOSSのオフライン機械翻訳ライブラリであり、PythonライブラリまたはCLIとして実行できる。

英語から日本語への `en → ja` モデルを使用する。

---

# 15. Argos Translateは「API」ではない

Argos Translateは外部SaaS APIとして利用するのではなく、

```text
GitHub Actions runner
        │
        ├ Node.js
        │   └ RSS処理
        │
        └ Python
            └ Argos Translate
```

のように、GitHub Actions runner内でローカル実行する。

そのため、

```text
API key
Azure account
Google Cloud account
課金設定
```

は初期実装では不要。

---

# 16. Node.js と Argosの接続

Repository本体はTypeScript / Node.jsであるため、Argos用の小さなPython bridgeを追加する。

推奨:

```text
scripts/translation/
└ argos_translate.py
```

TypeScript側:

```text
ArgosTranslator
       │
       ▼
child_process
       │
       ▼
python argos_translate.py
```

とする。

---

# 17. Argos bridgeの入出力

1テキストごとにPython processを起動してはならない。

翻訳対象をまとめて1回のPython processへ渡す。

例:

stdin:

```json
{
  "sourceLanguage": "en",
  "targetLanguage": "ja",
  "texts": [
    "Introducing Claude Opus 5.5",
    "Today we are announcing..."
  ]
}
```

stdout:

```json
{
  "translations": [
    "Claude Opus 5.5を発表",
    "本日、私たちは..."
  ]
}
```

TypeScript側で、

```ts
class ArgosTranslator implements Translator
```

を実装する。

Python bridgeのstdoutにはJSON以外を出さない。

ログはstderrへ出す。

---

# 18. Argosモデル

CI実行時に、

```text
en → ja
```

モデルが存在することを確認する。

存在しなければインストールする。

毎回モデルをネットワークから取得するのは避ける。

モデルまたはArgosのデータディレクトリをGitHub Actions Cacheで保持する。

例えば、

```text
.cache/argos/
```

またはArgosの標準モデルディレクトリをcache対象へ追加する。

モデル自体をGit repositoryへcommitしない。

---

# 19. Argos品質評価

Argosを採用する目的は、

> 最初から最高品質の翻訳を得ること

ではなく、

> 完全無料で翻訳版RSS生成を成立させ、実運用可能か確認すること

である。

特に以下を確認する。

```text
技術用語

AWS / Azure / Kubernetes等の製品名

OpenAI / Claude / Gemini等の固有名詞

短い記事タイトル

リリースノート特有の文章

コード・CLI・API名を含む文章
```

例えば、

```text
Introducing Amazon Bedrock AgentCore Runtime
```

などが不自然に翻訳される場合がある。

製品名まで翻訳・変形されるケースが頻発する場合、クラウド翻訳APIへの移行を検討する。

---

# 20. Provider移行判断

Argosで機能をリリースした後、一定期間利用する。

以下の場合にのみProvider変更を検討する。

```text
技術タイトルの意味が分かりにくい

固有名詞が頻繁に壊れる

翻訳によって意味が変わる

日本語として不自然すぎる

RSSタイトルを見ても記事内容を判断できない
```

単に、

```text
DeepLの方が多少自然
```

程度では変更しない。

無料運用を優先する。

---

# 21. 翻訳Provider候補

優先順位は以下。

| 優先度 | Provider | 種別 | コスト方針 | 用途 |
|---|---|---|---|---|
| **1** | **Argos Translate** | ローカルOSS | **完全無料** | 初期実装 |
| 2 | Azure AI Translator | Cloud API | 無料枠あり | Argos品質不足時 |
| 3 | Google Cloud Translation | Cloud API | 無料枠あり | Azure比較候補 |
| 4 | DeepL API | Cloud API | プラン依存 | 翻訳品質重視時 |

クラウドProviderへ移行する際は、実装時点の最新料金・無料枠・利用条件を必ず再確認する。

---

# 22. Azure AI Translator候補

Argosの精度に不満がある場合の第一候補。

実装:

```ts
class AzureTranslator implements Translator
```

として追加する。

必要なSecret例:

```text
AZURE_TRANSLATOR_KEY
AZURE_TRANSLATOR_REGION
AZURE_TRANSLATOR_ENDPOINT
```

Feed処理本体は変更しない。

設定上、

```text
TRANSLATION_PROVIDER=azure
```

等で切り替えられる設計が望ましい。

---

# 23. Google Cloud Translation候補

Azureとの比較候補。

実装:

```ts
class GoogleTranslator implements Translator
```

を追加する。

同じ `Translator` interfaceを実装する。

用途:

```text
Argosでは品質不足
かつ
AzureよりGoogleの翻訳結果が好ましい
```

場合。

Provider選定は翻訳品質を少数の記事で比較してから行う。

---

# 24. DeepL候補

必要であれば、

```ts
class DeepLTranslator implements Translator
```

も追加できる。

ただし今回の第一移行先として必須ではない。

初期設計としては、

```text
Argos
↓
必要ならAzure / Googleを比較
```

までを主経路とする。

---

# 25. Provider設定

例えば環境変数で、

```text
TRANSLATION_PROVIDER=argos
```

をdefaultにする。

許容値:

```text
argos
azure
google
```

初期値:

```text
argos
```

Provider factory:

```ts
createTranslator(config)
```

のような場所でのみProvider分岐する。

Feed生成側に、

```ts
if (provider === 'azure')
```

などを書かない。

---

# 26. Translation Cache

Providerに関係なく翻訳キャッシュを利用する。

保存先:

```text
.cache/translations/
```

GitHub Actionsでは既に `.cache` 全体を保存しているため、この仕組みを利用する。

---

# 27. Cache key

以下を含める。

```text
provider ID
provider/model version
source language
target language
source text
```

例えばArgos:

```text
argos:en-ja:model-1.1:<source text>
```

をSHA-256する。

概念:

```ts
sha256(
  [
    translator.id,
    sourceLanguage,
    targetLanguage,
    sourceText,
  ].join('\0')
)
```

Provider IDを含めることが重要。

例えば、

```text
Argosで一度翻訳
↓
Azureへ変更
```

したときにArgosの翻訳キャッシュを再利用してはいけない。

---

# 28. Cache granularity

記事単位ではなくテキスト単位。

```text
title

summary
```

を別々にキャッシュする。

これにより、

```text
title変更なし
summaryだけ更新
```

の場合、

```text
title → cache hit
summary → 再翻訳
```

となる。

---

# 29. Cache lifetime

現在 `.cache` は、

```text
constants.cachePruneThresholdInDays
```

に基づき14日でpruneされる。

現在の集約対象期間は8日なので、翻訳Cacheもこの既存pruneへ含めてよい。

```text
14日 > 8日
```

であるため、Feed掲載期間中は基本的に翻訳結果が維持される。

---

# 30. 翻訳処理フロー

```text
FeedCrawler
     │
     ▼
crawlFeedsResult.feedItems
     │
     ├─────────────────────────────┐
     │                             │
     ▼                             ▼
既存Feed生成                 Derived Feed生成
変更なし                         │
                                 ▼
                    sourceSectionIdで抽出
                                 │
                                 ▼
                    sourceLanguage=en
                                 │
                                 ▼
                        対象Item集合
                                 │
                                 ▼
                      title / summary
                                 │
                                 ▼
                     Translation Cache
                         │          │
                         ▼          ▼
                       Hit         Miss
                         │          │
                         │          ▼
                         │      Translator
                         │          │
                         └────┬─────┘
                              ▼
                     翻訳済みItem[]
                              │
                              ▼
                        FeedGenerator
                              │
                              ▼
                            AI-JP
```

---

# 31. 元Itemをmutateしない

既存Feedと翻訳Feedは同じCrawler結果から生成する。

したがって、

```ts
item.title = translatedTitle;
```

のような破壊的変更は禁止。

必ずcloneする。

```ts
const translatedItem = {
  ...originalItem,
  originalTitle: originalItem.title,
  title: translatedTitle,
  summary: translatedSummary,
};
```

---

# 32. summary / contentSnippet

元テキスト:

```ts
const sourceContent =
  item.summary ||
  item.contentSnippet ||
  '';
```

翻訳後は、

```ts
summary: translatedContent
```

へ統一してよい。

必要なら、

```ts
contentSnippet: translatedContent
```

にも同じ値を設定する。

元記事本文ページを追加fetchして全文翻訳してはならない。

---

# 33. FeedGenerator

既存 `FeedGenerator.generateFeeds()` を再利用する。

新しいRSS generatorを作らない。

```ts
feedGenerator.generateFeeds(
  translatedItems,
  ogObjectMap,
  hatenaCountMap,
  constants.maxFeedDescriptionLength,
  constants.maxFeedContentLength,
  translatedFeedMeta,
)
```

とする。

---

# 34. Feed metadata

AI-JP:

```text
title:
AI-JP｜企業テックブログRSS

description:
AIカテゴリの英語記事を日本語に翻訳してまとめたRSSフィード

language:
ja
```

元記事のlinkはそのまま利用する。

---

# 35. Item ID / GUID

翻訳版でも元記事と同じ記事URLを使用する。

```text
id
guid
link
```

を翻訳版独自URLへ変更しない。

原文Feedと翻訳版Feedは別Feedなので同一GUIDが存在してよい。

---

# 36. 並び順

元記事の、

```text
published
isoDate
```

を維持する。

翻訳完了日時をpublishedとして利用しない。

既存Section Feedと同様、新しい記事順に出力する。

---

# 37. 翻訳失敗時

翻訳機能の障害によって既存Feed生成を止めてはならない。

## Argos失敗

当該Itemについて、

```text
title → 英語原文
summary → 英語原文
```

へfallbackする。

記事自体は消さない。

## Azure / Google移行後

同様に、

```text
API timeout
429
5xx
```

等が起きてもFeed生成を継続する。

翻訳は **best-effort enrichment** とする。

---

# 38. Argos障害時の扱い

以下はwarning。

```text
Python実行失敗

Argos model missing

一部テキスト翻訳失敗
```

例えば:

```text
[translate] failed
provider=argos
section=ai-jp
url=...
```

既存Feed生成全体をfailさせない。

ただし、

```text
Argosの初期セットアップ自体が永久に壊れている
```

ことを検知できるよう、CIログは明確にする。

---

# 39. Argos用GitHub Actions

Node.jsに加えてPythonをセットアップする。

概念:

```yaml
- uses: actions/setup-python@...
  with:
    python-version: "3.x"

- run: pip install argostranslate
```

可能であればPython dependency versionを固定する。

Argosモデルもセットアップする。

モデルダウンロードを毎回行わないようcacheを利用する。

---

# 40. 初期実装ではSecret不要

Argos利用中は、

```text
AZURE_TRANSLATOR_KEY
GOOGLE_APPLICATION_CREDENTIALS
```

等は不要。

GitHub Actionsで必要なのは、

```text
Python runtime
Argos Translate package
en → ja model
```

だけ。

---

# 41. Azure等へ移行した場合

将来Azureへ切り替える場合のみ、

```text
TRANSLATION_PROVIDER=azure
AZURE_TRANSLATOR_KEY
AZURE_TRANSLATOR_REGION
AZURE_TRANSLATOR_ENDPOINT
```

をGitHub Actions Secrets / envへ追加する。

Googleの場合もProvider固有credentialsはProvider layerだけで扱う。

---

# 42. 翻訳対象ソース

## AI → AI-JP

20ソースすべて対象。

### Remote Feed

```text
https://openai.com/news/rss.xml
https://developers.openai.com/rss.xml
https://developers.googleblog.com/feeds/posts/default
https://research.google/blog/rss/
https://blog.google/technology/ai/rss/
https://deepmind.google/blog/rss.xml
https://engineering.fb.com/feed/
https://www.microsoft.com/en-us/research/feed/
https://machinelearning.apple.com/rss.xml
https://developer.nvidia.com/blog/feed/
https://huggingface.co/blog/feed.xml
https://bair.berkeley.edu/blog/feed.xml
https://ai.stanford.edu/blog/feed.xml
https://lilianweng.github.io/lil-log/feed.xml
https://sergeylevine.substack.com/feed
https://feeds.transistor.fm/talkrl
https://braininspired.co/feed/podcast
```

### Generated Feed

```text
anthropic-news
https://www.anthropic.com/news

claude-announcements
https://claude.com/blog-category/announcements

claude-code-blog
https://claude.com/blog-category/claude-code
```

Generated Feedを公開URLから再取得しない。

既存の、

```text
GeneratedFeedService
→ GeneratedFeedRegistry
→ FeedCrawler
```

を利用する。

---

# 43. AWS → AWS-JP

翻訳対象:

```text
https://aws.amazon.com/blogs/architecture/feed
https://aws.amazon.com/blogs/aws/feed/
https://aws.amazon.com/blogs/machine-learning/feed/
https://aws.amazon.com/blogs/big-data/feed/
https://aws.amazon.com/blogs/containers/feed/
https://aws.amazon.com/blogs/security/feed/
https://aws.amazon.com/blogs/database/feed/
https://aws.amazon.com/blogs/networking-and-content-delivery/feed/
https://aws.amazon.com/blogs/devops/feed/
https://aws.amazon.com/blogs/compute/feed/
https://aws.amazon.com/blogs/mt/feed/
https://aws.amazon.com/blogs/aws-insights/feed/
https://aws.amazon.com/blogs/enterprise-strategy/feed/
https://aws.amazon.com/blogs/aws-cloud-financial-management/feed/
https://aws.amazon.com/blogs/storage/feed/
https://aws.amazon.com/blogs/hpc/feed/
https://aws.amazon.com/blogs/developer/feed/
https://aws.amazon.com/blogs/mobile/feed/
https://aws.amazon.com/blogs/infrastructure-and-automation/feed/
https://aws.amazon.com/blogs/messaging-and-targeting/feed/
https://aws.amazon.com/blogs/desktop-and-application-streaming/feed/
https://aws.amazon.com/blogs/contact-center/feed/
https://aws.amazon.com/blogs/opensource/feed/
https://aws.amazon.com/blogs/dotnet/feed/
https://aws.amazon.com/blogs/ibm-redhat/feed/
https://aws.amazon.com/blogs/business-intelligence/feed/
https://aws.amazon.com/blogs/business-productivity/feed/
https://aws.amazon.com/blogs/iot/feed/
https://aws.amazon.com/blogs/robotics/feed/
https://aws.amazon.com/blogs/quantum-computing/feed/
https://aws.amazon.com/blogs/spatial/feed/
https://aws.amazon.com/blogs/migration-and-modernization/feed/
https://aws.amazon.com/blogs/modernizing-with-aws/feed/
https://aws.amazon.com/blogs/awsforsap/feed/
https://aws.amazon.com/blogs/apn/feed/
https://aws.amazon.com/blogs/awsmarketplace/feed/
https://aws.amazon.com/blogs/smb/feed/
https://aws.amazon.com/blogs/industries/feed/
https://aws.amazon.com/blogs/publicsector/feed/
https://aws.amazon.com/blogs/startups/feed/
https://aws.amazon.com/blogs/supply-chain/feed/
https://aws.amazon.com/blogs/gametech/feed/
https://aws.amazon.com/blogs/media/feed/
https://aws.amazon.com/blogs/training-and-certification/feed/
```

除外:

```text
https://aws.amazon.com/jp/about-aws/whats-new/recent/feed/
https://aws.amazon.com/jp/blogs/news/feed/
```

---

# 44. Azure → Azure-JP

```text
https://www.microsoft.com/releasecommunications/api/v2/azure/rss
https://azure.microsoft.com/en-us/blog/feed/
https://devblogs.microsoft.com/feed/
```

---

# 45. Google Cloud → Google Cloud-JP

```text
https://cloudblog.withgoogle.com/products/gcp/rss
https://cloud.google.com/feeds/gcp-release-notes.xml
```

対象外:

```text
https://cloudblog.withgoogle.com/ja/products/gcp/rss/
```

---

# 46. Database → Database-JP

```text
https://www.mongodb.com/blog/rss
https://www.postgresql.org/news.rss
https://blogs.oracle.com/mysql/rss
https://neon.com/blog/rss.xml
https://neon.com/docs/changelog/rss.xml
https://supabase.com/rss.xml
https://redis.io/blog/feed/
https://clickhouse.com/rss.xml
https://www.duckdb.org/feed.xml
https://www.databricks.com/feed
https://qdrant.tech/index.xml
https://qdrant.tech/articles/index.xml
https://weaviate.io/blog/rss.xml
https://github.com/milvus-io/milvus/releases.atom
```

---

# 47. Engineering → Engineering-JP

```text
https://netflixtechblog.com/feed
https://github.blog/engineering/feed/
https://airbnb.tech/feed/
https://slack.engineering/feed/
https://blog.cloudflare.com/rss/
https://engineering.atspotify.com/feed/
https://dropbox.tech/feed
https://medium.com/feed/pinterest-engineering
https://stripe.com/blog/feed.rss
https://discord.com/blog/rss.xml
https://www.etsy.com/codeascraft/rss
https://tech.instacart.com/feed
https://www.reddit.com/r/RedditEng/.rss
https://engineering.salesforce.com/feed/
https://www.atlassian.com/engineering/feed
https://engineeringblog.yelp.com/feed.xml
```

---

# 48. Platform → Platform-JP

```text
https://kubernetes.io/feed.xml
https://www.docker.com/blog/feed/
https://about.gitlab.com/atom.xml
https://vercel.com/atom
https://developer.chrome.com/static/blog/feed.xml
https://hacks.mozilla.org/feed/
https://webkit.org/feed/
https://developer.apple.com/news/rss/news.rss
https://blog.tensorflow.org/feeds/posts/default?alt=rss
https://github.com/pytorch/pytorch/releases.atom
https://www.datadoghq.com/blog/engineering/index.xml
https://grafana.com/blog/index.xml
https://www.elastic.co/blog/feed
https://www.hashicorp.com/blog/feed.xml
https://snyk.io/blog/feed/
```

---

# 49. Programming → Programming-JP

```text
https://nodejs.org/en/feed/blog.xml
https://react.dev/rss.xml
https://blog.python.org/rss.xml
https://blog.rust-lang.org/feed.xml
https://go.dev/blog/feed.atom
```

---

# 50. Robotics → Robotics-JP

```text
https://www.therobotreport.com/feed/
https://spectrum.ieee.org/rss/robotics/fulltext
```

---

# 51. Security Advisory → Security Advisory-JP

```text
https://azu.github.io/github-advisory-database-rss/npm.rss
https://azu.github.io/github-advisory-database-rss/actions.rss
https://azu.github.io/github-advisory-database-rss/pip.rss
```

---

# 52. Security → Security-JP

```text
https://github.blog/security/feed/
https://www.microsoft.com/en-us/security/blog/feed/
https://blog.trailofbits.com/feed/
```

その他のSecurityカテゴリFeedは対象外。

---

# 53. TechCrunch → TechCrunch-JP

```text
https://techcrunch.com/feed/
```

---

# 54. 今回翻訳しないもの

```text
Speaker Deck
Menthas
企業テックブログRSS
Qiita各Feed
Zenn各Feed
国内テックブログ内の多言語Feed
```

理由:

```text
Feed単位で言語を固定できない
```

ため。

記事単位言語判定はPhase 2とする。

---

# 55. 推奨ファイル構成

追加:

```text
src/feed/translation/
├ translator.ts
├ translation-service.ts
├ translation-cache.ts
├ translator-factory.ts
├ argos-translator.ts
├ azure-translator.ts      # 初期実装では不要でもよい
└ google-translator.ts     # 初期実装では不要でもよい

scripts/translation/
└ argos_translate.py

src/resources/
├ translated-sections.json
└ translated-section-list.ts
```

変更:

```text
src/resources/feed-info-list.ts
src/feed/feed-crawler.ts
src/feed/feed-generator.ts
src/feed/feed-storer.ts
src/cli/generate-feed-command.ts
src/common/constants.ts

対象の src/resources/sections/*.json

.github/workflows/generate-feed.yml
.github/actions/restore-feed-cache/action.yml
.github/actions/save-feed-cache/action.yml
```

---

# 56. generate-feed-command.ts

既存Crawler結果を再利用する。

概念:

```ts
const translatedSectionFeedDistributionSets =
  new Map<string, FeedDistributionSet>();

for (const definition of TRANSLATED_SECTION_DEFINITION_LIST) {
  const sourceItems =
    crawlFeedsResult.feedItems.filter(
      (item) =>
        item.sectionId === definition.sourceSectionId &&
        item.sourceLanguage === definition.sourceLanguage,
    );

  if (sourceItems.length === 0) {
    continue;
  }

  const translatedItems =
    await translationService.translateItems(
      sourceItems,
      definition.sourceLanguage,
      definition.targetLanguage,
    );

  const result =
    feedGenerator.generateFeeds(
      translatedItems,
      ogObjectMap,
      crawlFeedsResult.feedItemHatenaCountMap,
      constants.maxFeedDescriptionLength,
      constants.maxFeedContentLength,
      createTranslatedSectionFeedMeta(definition),
    );

  translatedSectionFeedDistributionSets.set(
    definition.id,
    result.feedDistributionSet,
  );
}
```

---

# 57. FeedStorer

現在の `storeSectionFeeds()` はrootを削除して再生成するため、

```text
通常Section
↓ storeSectionFeeds()

翻訳Section
↓ storeSectionFeeds()
```

と2回呼んではならない。

後者が既存Sectionを削除する。

推奨:

```ts
const allSectionFeedDistributionSets =
  new Map([
    ...sectionFeedDistributionSets,
    ...translatedSectionFeedDistributionSets,
  ]);

await feedStorer.storeSectionFeeds(
  allSectionFeedDistributionSets,
  STORE_SECTION_FEEDS_DIR_PATH,
);
```

---

# 58. テスト

最低限以下をテストする。

## Feed language

```text
language=en
→ FeedInfo.language=en

language未指定
→ unknown

Generated Feed language=en
→ en
```

## FeedCrawler

```text
FeedInfo.language
→ FeedItem.sourceLanguage
```

## Translation Cache

```text
cache miss
→ Translator実行

cache hit
→ Translatorを実行しない

source text変更
→ miss

Provider変更
→ miss

model/version変更
→ miss
```

## TranslationService

```text
title翻訳

summary翻訳

contentSnippetのみでも翻訳

originalTitle保持

link維持

isoDate維持

blogTitle維持
```

## Filtering

```text
sectionId=ai + sourceLanguage=en
→ AI-JPへ含める

sectionId=ai + ja
→ 含めない

sectionId=aws + en
→ AI-JPへ含めない
```

## Failure

```text
Translator failure
→ 記事を削除しない
→ 原文へfallback
```

## Regression

既存Feedについて、

```text
記事数
タイトル
URL
日時
```

等が意図せず変化しないこと。

---

# 59. Argos専用テスト

FakeTranslatorだけでなく、Argosの最小integration testも用意する。

例えば、

```text
Introducing a new API for developers
```

を `en → ja` 変換し、

```text
空文字にならない
英語原文と完全一致ではない
process exit code = 0
```

程度を確認する。

翻訳文そのものを完全一致でassertしない。

モデルやライブラリ更新で表現が変わる可能性があるため。

---

# 60. 初期リリース手順

以下の順序で実装する。

```text
1.
Feed定義へlanguage追加

2.
FeedInfo / FeedItemへlanguage伝播

3.
TranslatedSectionDefinition追加

4.
Translator interface追加

5.
Translation Cache追加

6.
FakeTranslatorでAI-JP生成まで完成

7.
Argos Python bridge追加

8.
en → jaモデル導入

9.
ArgosTranslator実装

10.
AI-JPのみArgosでEnd-to-End確認

11.
実際のAI記事タイトルを20〜50件程度目視確認

12.
問題なければAWS-JP等へ横展開

13.
全Translated Feed生成

14.
数日〜数週間運用

15.
品質に不満がある場合のみ
Azure / Googleを比較

16.
優位性が十分ならProviderを切り替える
```

---

# 61. Provider移行時の評価方法

ArgosからクラウドProviderへ移行する場合、感覚だけで決めず、同じ入力を比較する。

例えば50〜100タイトル程度について、

```text
Argos
Azure
Google
```

を並べる。

評価ポイント:

```text
意味の正確さ

技術用語

固有名詞保持

日本語の自然さ

記事タイトルとして内容を判断できるか
```

最も重要なのは、

> RSS一覧でタイトルを見て、読むべき記事か判断できること

である。

文学的な自然さは重要ではない。

---

# 62. コスト方針

基本方針:

```text
可能な限り0円
```

とする。

したがって初期Providerは必ずArgos。

クラウドAPIへの切り替えは、

```text
Argosの品質が実用上不足
```

した場合だけ行う。

またクラウドProviderへ移行しても、

```text
Translation Cache
```

を維持し、新着・変更テキストのみ翻訳する。

API利用量を最小化する。

---

# 63. 非要件

今回は以下を実装しない。

```text
元記事本文ページの全文翻訳

HTML本文スクレイピング

LLM翻訳

LLM要約

記事要約

タイトルの意図的な要約

日本語Feedとの混合

mixed Feedの記事単位言語判定

Speaker Deck翻訳

Qiita / Zenn翻訳

翻訳結果の編集UI

複数翻訳Providerへの同時リクエスト
```

---

# 64. Acceptance Criteria

実装完了条件:

```text
1.
既存RSS / Atom / JSON Feedが壊れていない。

2.
AI-JPが生成される。

3.
AI-JPにAIカテゴリの英語20ソースだけが入る。

4.
20ソースが1本へマージされる。

5.
titleが日本語化される。

6.
summary/contentSnippetも日本語化される。

7.
blogTitle / link / published等は維持される。

8.
originalTitleに英語原文が残る。

9.
AWS-JP等も同じ構造で生成される。

10.
AWS-JPに日本語AWS Feedが混ざらない。

11.
初期ProviderとしてArgos Translateを利用する。

12.
ArgosはGitHub Actions runner内でローカル実行される。

13.
外部翻訳APIの契約・API keyなしで動作する。

14.
同一テキストを毎回再翻訳しない。

15.
翻訳CacheがProvider/modelごとに分離される。

16.
翻訳失敗で記事が消えない。

17.
翻訳失敗で既存Feed生成が止まらない。

18.
ProviderをAzure / Google等へFeed処理を変更せず差し替えられる。

19.
npm run lint が通る。

20.
npm run test が通る。

21.
npm run feed-generate が通る。
```

---

# 65. Coding Agentへの最終指示

このRepositoryの既存アーキテクチャを尊重し、最小変更で実装すること。

特に、

```text
FeedCrawler
FeedGenerator
FeedStorer
GeneratedFeedService
section definitions
existing cache
```

を再利用し、翻訳機能用の並行したFeed frameworkを新設しない。

Translated Feedは、

```text
crawlFeedsResult.feedItems
```

から派生させる。

翻訳処理は、

```text
Feed processing
↓
Translator interface
↓
Provider implementation
```

と分離する。

初期Providerは **Argos Translate** とする。

まず、

```text
AI-JP
```

だけをArgosでEnd-to-End生成し、正常動作と翻訳品質を確認する。

正常に動くことを確認した後に他カテゴリへ横展開する。

Argosの翻訳品質が実用上十分なら、そのまま無料運用を継続する。

品質が不十分な場合のみ、同一 `Translator` interfaceを利用して、

```text
Azure AI Translator
Google Cloud Translation
```

等を比較・導入する。

クラウドProvider導入を前提としてArgos実装を簡略化したり、最初から有料APIへ依存したりしないこと。

実装後は、

```text
npm run lint
npm run test
npm run feed-generate
```

を実行し、

```text
既存Feed
翻訳Feed
```

双方を検証すること。