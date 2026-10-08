特にqiitaとzennのfeedで、すべてのURLをslackで登録していると何度も同じ記事が投稿されます。

企業テックブログ系のものと重複することもあります。昨日見た記事が今日も出てくることもあります

これらの重複を排除することは可能？
排除のための集約単位と、集約した場合にどういう感じの出力になるか（各feed購読だとリアルタイムだが、集約は1時間おきになる、とか、抜け漏れが発生する可能性がある、とか）
教えてほしい。

いま時点で重複が発生している可能性があるfeed単位も知りたい



---


可能です。**重複を除く範囲を、同じチャンネル内にするか、複数チャンネル全体にするか**で設計が変わります。

Slack登録一覧と公開済みの取得履歴を照合したところ、実際に同じ記事URLが複数RSSに含まれていました。今回は調査のみで、コード・購読設定は変更していません。

**確認できた重複**

以下は、9/28 0:00〜9/29 14:08 JST時点の取得記録です。Slackの通知回数ではなく、元記事の公開日を基準にしたRSS掲載の重複です。

| 集約対象 | RSSの登録数 | 延べ記事数 | URLで重複除外した記事数 |
|---|---:|---:|---:|
| Zenn AI関連タグ | 12 | 278 | **174** |
| Qiita AI関連タグ | 12 | 160 | **94** |
| Zenn Cloud関連タグ | 6 | 35 | **33** |
| Qiita Cloud関連タグ | 6 | 25 | **22** |

例えば、Zennの同じ記事が「Claude・AIエージェント・LLM・AWS・karaageAI情報」の5フィードに載っていました。

カテゴリをまたぐ重複もあります。

| 組み合わせ | 共通する記事数 |
|---|---:|
| karaageAI情報 × Zenn AI | **93** |
| 企業テックブログRSS × 国内テックブログの個別RSS | **30** |
| karaageAI情報 × ITmedia | 28 |
| karaageAI情報 × 企業テックブログRSS | 15 |
| karaageAI情報 × 国内テックブログ | 14 |
| 企業テックブログRSS × Zenn AI | 10 |
| 国内テックブログ × Zenn Cloud | 6 |
| 国内テックブログ × Zenn AI | 5 |
| Qiita AI × Qiita Security | 5 |
| Zenn AI × Zenn Security | 4 |
| Zenn トレンド × Zenn AI | 3 |
| Qiita 人気記事 × Qiita AI | 3 |

件数は組み合わせ同士でも重なるため、合算できません。

具体的な企業RSSでは、ヘッドウォータース、LINEヤフー、フューチャー、CyberAgent、エムスリー、ソフトバンク、Fusic、エクサウィザーズなどが、企業テックブログRSSと重複していました。

また、**LINEヤフーは同じチャンネルに次の2本が登録され、4記事が共通しています。**

- `https://engineering.linecorp.com/ja/feed/`
- `https://techblog.lycorp.co.jp/ja/feed/index.xml`

確認できた**209組のRSSペアと、タイトル・URL・投稿先**は、[調査一覧](/private/tmp/rss-duplicate-audit.md)にまとめました。取得履歴に残っていない重複や、別URLでの転載は含まないため、実際の重複範囲はさらに広い可能性があります。

**集約する単位による違い**

| 集約単位 | 防げる重複 | 残る重複・注意点 |
|---|---|---|
| 現在のカテゴリごと | Zenn AI内の12タグ間など | AI・Cloud・トレンド・企業ブログ間は残る |
| Zenn全体／Qiita全体 | 各サービスのタグ・トレンド・企業アカウント間 | 外部の企業ブログ集約やkaraageAI情報との重複は残る |
| 関連カテゴリをまとめた1本 | Zenn・Qiita・企業ブログ・karaageAI情報など、対象全体 | 通知先が1チャンネルにまとまる |
| チャンネルを維持し、共通履歴で配信先を1つ選ぶ | 対象チャンネル間全体 | 各チャンネル単独では、そのテーマの記事が全部は届かなくなる |

**一番簡単なのは、現在のカテゴリ別の自家製RSSに置き換える方法です。** 既に同じRSS内では記事URLで重複を除いています。公開中のZenn・Qiita計8カテゴリのRSSでも、同一URLの重複がないことを確認しました。

例えば、SlackのZenn AIチャンネルに登録している12本を、次の1本に置き換えます。

- [Zenn AI 集約RSS](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/zenn-ai/feeds/rss.xml)
- [Qiita AI 集約RSS](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/qiita-ai/feeds/rss.xml)
- [Zenn Cloud 集約RSS](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/zenn-cloud/feeds/rss.xml)
- [Qiita Cloud 集約RSS](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/qiita-cloud/feeds/rss.xml)

元の12本と集約RSSを両方購読すると重複は続くため、**追加ではなく置き換え**になります。

企業ブログとの重複までなくすなら、関連カテゴリをまとめた専用RSS、またはチャンネル間の共通配信履歴が必要です。全44通常カテゴリをまとめる[全体RSS](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/rss.xml)も既にありますが、対象が広く、翻訳版は含みません。

**集約後の出力イメージ**

集約しても「1時間分を1投稿」にする必要はありません。**1記事につき1つのRSS項目・Slack投稿**として、更新時に新着分をまとめて配信できます。

現行の形式は、おおむね次のようになります。

```text
記事タイトル | 配信元名

元記事公開：2026/9/29 10:15:00（日本時間）

記事の概要…
記事URL
```

専用の横断集約を作るなら、本文に次の情報も載せられます。

```text
分類：Zenn / AI / Cloud
掲載元：企業ブログ、Zenn LLM、Zenn AWS
```

この「複数の掲載元をまとめた表示」は現在の仕様にはありません。

**配信間隔と、抜け漏れの条件**

直接購読も完全なリアルタイムではなく、SlackがRSSを巡回したタイミングで届きます。Slackはフィードごとの最終取得記事日時を保存し、それより新しい日時の記事を取得する仕様です。[Slack公式説明](https://slack.com/help/articles/218688467-Add-RSS-feeds-to-Slack)

| 方式 | 配信までの待ち時間 |
|---|---|
| 元RSSを直接購読 | 元RSS更新 → Slackの次回巡回 |
| 現在の自家製RSSを購読 | 次回GHA → 生成・Pages公開 → Slackの次回巡回 |

現在のGHAは通常、平日1時間・週末2時間間隔で、JST 0時にも実行します。**JST 1〜7時台には定期実行がありません。** 曜日はUTC判定です。また、元RSSの1時間キャッシュ、Actionsの起動遅延、生成・公開時間があるので、「必ず1時間以内」とは言えません。

取りこぼしについては、特に次が重要です。

- **巡回の間に元RSSから消えた記事は取得できません。** 今回取得したQiitaのAI・LLMタグRSSは各4記事、ZennのAI・LLMは各20記事でした。記事数が少ないRSSほど、更新が多い時間帯や夜間の未巡回が影響します。
- 現在の集約対象は**元記事公開日時が過去8日以内**です。古い記事が後からトレンド入りした場合などは対象外になり得ます。
- 取得済み記事は、同じ自家製RSS内なら、再登場しても通知日時を更新しません。識別履歴は最後の取得から90日間保持します。
- 同じ内容でも記事URLが異なる転載は、URL一致だけでは除外できません。タイトルだけで除外すると、別記事を誤って消すおそれがあります。

「昨日見た記事が今日も届く」のは、翌日に別タグ・トレンド・集約RSSへ掲載された場合にも起きます。今回の日時対応は**同じ自家製RSS内の再通知を抑えるもの**で、外部RSS同士やカテゴリ間の重複までは抑えません。

私のおすすめは、**まずカテゴリ内の複数RSSを自家製RSS1本へ置き換え、その前にQiitaなどの短いRSSを取りこぼしにくい巡回間隔と対象期間を整えること**です。そのうえで、企業ブログとの重複も不要なら、関連カテゴリをまとめた通知用RSSを用意するのが分かりやすいです。


-----


優先度として、企業別ブログ > Zenn・Qiitaタグとして、
まず起業別ブログはユニークとして出力
そのあと、Zennに起業別ブログで既出が出ても、無視する。タグマージして複数出る場合も重複排除する
とすればだいたいOKになる？
つまり、feedは既存のtech blog jpと、
zenn-dedup = trend + ai + aws + ...
qiita-dedup = trend + ai +aws + ...
のようなマージ重複排除の自家製feedが1つできるイメージで良い？
これだと他に重複がでる？ハテブとか？



----


はい。**その3系統にまとめれば、企業ブログ・Zenn・Qiita間の重複はかなり減らせます。** ただし、「後から企業ブログ側で取得した記事」の扱いだけ決める必要があります。

想定する構成は、以下で合っています。

| 出力RSS | 集約する入力 | 重複排除 |
|---|---|---|
| 国内テックブログ（既存`jp-tech-blog`） | 登録済みの企業別ブログ | 同じ記事URLは1件 |
| `zenn-dedup` | トレンド＋AI＋Cloud＋Security | タグ間の重複を除き、企業ブログ側で既出の記事も除く |
| `qiita-dedup` | 人気記事＋AI＋Cloud＋Security | タグ間の重複を除き、企業ブログ側で既出の記事も除く |

各RSSは1記事ずつ出力します。同じ記事が翌日別タグに登場しても、保存した履歴で除外します。Slackでは、対象の個別RSSをこの集約RSSに置き換えます。

**注意点は、取得順序と優先順位が一致しない場合です。**

同じ生成処理で企業ブログとZennの両方に記事があれば、企業ブログを優先できます。企業ブログで昨日取得済みなら、今日のZennからも除外できます。

一方、次の順序はあり得ます。

```text
10:00  Zennタグで初めて取得 → Zennに配信
11:00  企業ブログRSSで同じ記事を取得
```

このときは、次のどちらかになります。

| 方針 | 結果 |
|---|---|
| 企業ブログには必ず出す | 企業ブログにも配信され、2回になる |
| 3系統全体で1回にする | 企業ブログ側では配信しない。企業ブログRSS単独では全記事がそろわない |

**重複削減が主目的なら、「同時取得は企業ブログ優先、別の実行ですでに配信した記事は再配信しない」をおすすめします。** これは「企業ブログを必ず完全に配信する」とは少し違います。Zenn側を一定時間保留する方法もありますが、通知が遅くなり、企業ブログの遅延取得を完全には解消できません。

**この3系統の外には、重複が残ります。**

| 別途購読しているフィード | 残る重複 |
|---|---|
| **企業テックブログRSS（yamadashy版）** | 国内テックブログ・Zennとの重複 |
| **karaageAI情報** | Zenn AI・企業ブログ・ITmediaなどとの重複 |
| **はてなブックマーク** | 企業ブログ・Zenn・ニュース記事が後から人気入り |
| **Menthas** | はてブ・ITmedia・各ブログなどとの重複 |
| **個人ブログ** | Zennの個人フィードなどとタグ・トレンドの重複 |
| 原文RSSと翻訳RSS | 同じ記事の原文・翻訳をそれぞれ配信 |

特に、**既存の`jp-tech-blog`と、yamadashy版の「企業テックブログRSS」は別の入力です。** 前の調査では両者に30記事の重複がありました。企業ブログを1系統にするなら、yamadashy版も同じ重複排除の対象に含める必要があります。

したがって、最初の構成としては次が妥当です。

```text
企業ブログ系
  国内の企業別ブログ＋企業テックブログRSS
          ↓ 優先
Zenn統合
  トレンド＋各タグ
          ↓
Qiita統合
  人気記事＋各タグ

3系統で共通の配信済み記事履歴を持つ
```

はてブやkaraageAI情報は「別の視点で選ばれた記事を再び見る」価値もあるため、当初は別扱いにできます。**そこも含めて1記事1通知にしたい場合は、同じ配信済み履歴の対象へ加える**設計にすれば対応できます。




-----


企業テックブログRSS（yamadashy版）
と
jp tech blogって、どちらかがどちらかを内包してますか？
片方だけ追っておけばOKの状態にできる？

karaageAI情報も、リポで内包できる？



-----

はい。**karaageAI情報も、このリポジトリの自家製RSSに取り込めます。** 実は取得元としては既に`ai-news`カテゴリに登録済みです。必要なのは、企業ブログ・Zenn・Qiitaとの共通の重複排除です。

先ほどの包含関係も確認しました。**yamadashy版と`jp-tech-blog`は、どちらも相手を完全には内包していません。**

| 比較 | 例 |
|---|---|
| yamadashy版にあり、`jp-tech-blog`にない取得元 | Findy、カカクコム、SOELUなど |
| `jp-tech-blog`にあり、yamadashy版にない取得元 | IBMなどのQiita Organization、EpicAIのZenn、Serverless Operationsの自家製RSSなど |

企業単位では双方に登録があっても、会社ブログとQiita Organizationなど、取得する媒体が異なる場合もあります。[yamadashy版の登録元一覧](https://github.com/yamadashy/tech-blog-rss-feed/blob/main/src/resources/feed-info-list.ts)

**片方だけ購読すればよい状態にはできます。** このリポジトリ側で、次のようにまとめる構成が自然です。

| 配信RSS | 入力 |
|---|---|
| 企業ブログ統合 | `jp-tech-blog`の企業別RSS ＋ yamadashy版 |
| Zenn統合 | トレンド＋各タグ |
| Qiita統合 | 人気記事＋各タグ |
| karaageAI情報・重複除外版 | karaageAI情報RSS |

この4系統で配信済み記事の履歴を共有し、同時に取得した同一記事は、例えば **企業ブログ → Zenn・Qiita → karaageAI情報** の優先順位で1か所に出します。別の実行で配信済みなら、後から他の入力に登場しても再配信しません。

これなら、karaageAI情報でしか見つからない記事は受け取りつつ、Zennや企業ブログとの重複を減らせます。Slackでは、yamadashy版・企業別RSS・karaage版の直接購読を、対応する自家製RSSへ置き換えます。

ただし、**外部の集約RSSを入力として取り込む形なので、その配信元での取得漏れや更新待ちは引き継ぎます。** 配信元の全ブログをこのリポジトリから直接巡回する構成とは異なります。また、はてブ・Menthasなどを直接購読し続ける場合、その間の重複は残ります。



----


ちがうちがう、それぞれの
企業テックブログRSS（yamadashy版）
karaage ai news
がフォローしているRSSの大元は、このリポの他のカテゴリ（tech blog jpとか）でカバーしているかどうかが知りたい。
つまり、この2つは取らなくても、既存カテゴリで全部内包できているかが知りたい


----




すみません、意図を取り違えていました。**2つの集約RSSそのものを除外し、残りの全カテゴリが直接取得しているRSSと照合しました。**

結論は、**yamadashy版は内包できていません。karaage版は大部分をカバーしていますが、完全内包とは確認できません。**

| 集約RSS | 大元RSSの登録数 | 既存カテゴリとURLが一致 | URLが一致しない |
|---|---:|---:|---:|
| yamadashy版 | 702本 | 43本 | 659本 |
| karaageAI情報 | 40本 | 33本 | 7本 |

HTTP/HTTPS・末尾スラッシュ・エンコードの表記差は正規化しています。URLが違っても同じ内容を配信する場合があるため、右端はそのまま不足数ではありません。参照：[yamadashyの定義](https://github.com/yamadashy/tech-blog-rss-feed/blob/main/src/resources/feed-info-list.ts)、[karaageの定義](https://github.com/karaage0703/tech-blog-rss-feed/blob/main/src/resources/feed-info-list.ts)

**yamadashy版は、外すと購読範囲が大きく減ります。**

Findy、カカクコム、SOELUなど、他カテゴリに取得元が登録されていないブログが多数あります。Zennトレンドやはてブで一部の記事が届くことはあっても、それらのブログ全体をカバーすることにはなりません。

**karaage版の残り7本は、次の状態でした。**

| 大元RSS | このリポジトリでのカバー状況 |
|---|---|
| ABEJA | 別URLで登録済み。取得した30記事のURLが一致 |
| Google Developers Japan | FeedBurner経由で登録済み。HTTP/HTTPS差を除き25記事が一致 |
| Zenn 機械学習タグ | `machinelearning`で登録済み。各20記事中18記事が一致し、取得時点の掲載集合には差あり |
| AI Shift | **個別登録なし**。ただしkaraage側の登録URLも現在404 |
| Preferred NetworksのLLM/PLaMo | 全体RSSの登録はあるが、現在は転送先がHTML。karaage側の限定RSSも転送後404 |
| エクサウィザーズ | Zennは登録済み。karaage側の旧ブログRSSはTLS接続失敗。旧ブログとの完全な同一性は未確認 |
| EXPLAZA | Zennは登録済み。karaage側の旧ブログRSSはTLS接続失敗。旧ブログとの完全な同一性は未確認 |

したがって、判断は以下です。

- **yamadashy版：既存カテゴリだけでは代替できないので、現状で外すのは不適切。**
- **karaage版：ほぼ代替できる構成。ただし「外しても全部同じ」とはまだ言えない。** 機械学習タグの掲載差と、残る4取得元の扱いを整理すれば、直接購読だけにする判断ができます。

[全取得元の照合一覧](/private/tmp/aggregator-origin-coverage.md)も用意しました。リポジトリの設定は変更していません。


----


不足しているfeed listください


タイトル・RSS URL付きの全一覧です。

- **[yamadashy版：未登録候補659本の一覧](/private/tmp/yamadashy-missing-feed-list.md)**
- **[karaage版：URL未一致7本の一覧・判定](/private/tmp/karaage-missing-feed-list.md)**

これは**登録URLの差分**です。別URLで取得済みのものも含むため、すべてを追加する必要があるわけではありません。確認できた同等URL・取得エラーは一覧に注記しています。

karaage版で、取得済み相当のABEJA・Google Developers Japanを除くと、確認対象は以下です。

| フィード名 | RSS URL | 状況 |
|---|---|---|
| AI Shift | https://www.ai-shift.co.jp/techblog/feed | 未登録。ただし現在404 |
| Preferred Networks：LLM/PLaMo | https://tech.preferred.jp/ja/blog/llm-plamo/feed/ | 転送後404。リポの全体RSSも現在RSSとして取得不可 |
| Zenn 機械学習 | https://zenn.dev/topics/機械学習/feed | リポの`machinelearning`版と掲載記事に差あり |
| エクサウィザーズ | https://techblog.exawizards.com/feed | TLS接続失敗。リポには同社Zennを登録済み |
| EXPLAZA | https://tech.explaza.jp/feed | TLS接続失敗。リポには同社Zennを登録済み |

特に404・接続失敗のURLは、そのまま追加せず、有効な配信先を確認する必要があります。


-----


その場所だと私がファイルみれません


----

リポジトリ内のmy-docs/に配置しました。

yamadashy版：未登録候補659本 (my-docs/yamadashy-missing-feed-list.md)
karaage版：URL未一致7本と判定 (my-docs/karaage-missing-feed-list.md)


---


既存と内容が一致していない、かつ404でないものは？



----


**正常にRSSを取得でき、既存の取得結果にない記事URLを含むものは481本でした。**

→ **[該当481本のタイトル・RSS URL一覧](/Users/fuhitonakagawa/my-tech-blog-rss-feed/my-docs/missing-feeds-verified.md)**

| 判定 | 件数 |
|---|---:|
| RSS取得成功・既存と記事URLに差分あり | **481本** |
| 既存と同じ記事集合・転送先のため除外 | 8本 |
| 404のため除外 | 3本 |
| 取得制限・接続失敗などで判定保留 | 170本 |

481本はすべてyamadashy版由来です。karaage版では条件を満たす候補を確定できていません。

[除外・判定保留の一覧](/Users/fuhitonakagawa/my-tech-blog-rss-feed/my-docs/missing-feeds-audit-details.md)もあります。保留のうち157本はZennの取得制限（429）です。

なお、比較は**取得時点の記事URL集合**です。RSSの収録件数や更新タイミングの違いも差分になるため、481本すべてが完全に新しい配信元という意味ではありません。


----


そのなかで、このリポが単体登録していないものは？


---


**RSS URL単位では、481本すべてがこのリポジトリに単体登録されていないものです。**

一覧は、次の条件で絞っています。

1. 全カテゴリの単体登録RSSとURLが一致しない
2. 正常にRSSを取得できる
3. 既存の取得結果にない記事URLを含む

→ [該当481本の一覧](/Users/fuhitonakagawa/my-tech-blog-rss-feed/my-docs/missing-feeds-verified.md)

ただし、**同じブログの別RSSは含みます。** 例えばヌーラボは、全体RSSを登録済みですが、一覧には技術カテゴリRSSが入っています。

そのため「そのブログ自体を一切登録していないもの」に限定する場合は、さらに配信元単位で絞る必要があります。


----




話を戻して、
これらもマージしたうえで重複排除する場合、
企業techblog dedup = my tech blog jp + yamadashy + karaage
Zenn dedup
Qiita dedup
の3本で良さそう？


----



はい。**今回の対象なら、その3本でよいと思います。**

| 出力RSS | 集約する入力 |
|---|---|
| **企業TechBlog dedup** | `jp-tech-blog`＋yamadashy版＋karaageAI情報 |
| **Zenn dedup** | Zennトレンド＋AI・Cloud・Securityの各タグ |
| **Qiita dedup** | Qiita人気記事＋AI・Cloud・Securityの各タグ |

yamadashy版・karaage版を入力に使うので、先ほどの未登録候補を個別に追加する必要はありません。

重複排除のルールは、以下にすると意図に合います。

- **3本で共通の配信履歴を持つ。** 各RSS内だけでなく、3本をまたいで同じ記事URLを1回にする。
- **同じ実行で重なったら企業TechBlogを優先する。**
- **過去に配信した記事は、翌日別の入力に登場しても再配信しない。**
- Zenn側で先に配信した記事が後から企業側に来た場合も、再配信しない。

Slackでは、対象の個別RSS・集約RSSの登録を、この3本へ**置き換える**必要があります。

注意点は2つあります。

- **はてブ・Menthas・別途購読する個人ブログなどとの重複は残ります。**
- karaageにはメディア記事や個人のZenn記事も含まれるので、企業TechBlogには企業以外の記事も入ります。名前は **「Tech・AI dedup」**などの方が実体に合います。

同じ内容でもURLが異なる転載は別記事として扱う、という範囲なら、この構成で整理できます。



----



では、表示優先度は、時間が早ければそれが優先ですが、同時刻生成の場合に限り
企業TechBlog dedup > Zenn = Qiita
として、feed生成パイプ作ってください



----



3本の生成パイプラインを実装しました。

- **企業TechBlog dedup**：国内テックブログ＋yamadashy＋karaage
- **Zenn dedup**：トレンド＋各タグ
- **Qiita dedup**：人気記事＋各タグ

先に配信した所属を維持し、**同じ生成回の新規記事だけ「企業TechBlog > Zenn = Qiita」**で判定します。購読ページ・日次統計・README・AGENTS.mdも対応しています。

内部テスト358件、lint・型チェック・依存監査、サイトビルドが通っています。保存済み819記事でも重複・割り当て漏れ0件を確認しました。ローカルの実サイト取得にはZennの429制限がありました。

**まだ未公開です。** push後、以下に生成されます。

```text
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/tech-blog-dedup/feeds/rss.xml
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/zenn-dedup/feeds/rss.xml
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/qiita-dedup/feeds/rss.xml
```


-----


pushしたので、ちゃんとマージ・dedupされてできてくるか、監視してください


----


**生成・デプロイ・Pages公開まで成功し、公開RSSでマージと重複排除を確認しました。**

| RSS | 掲載件数 |
|---|---:|
| [企業TechBlog dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/tech-blog-dedup/feeds/rss.xml) | 563 |
| [Zenn dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/zenn-dedup/feeds/rss.xml) | 223 |
| [Qiita dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/qiita-dedup/feeds/rss.xml) | 83 |

- 入力のユニーク記事**869件＝出力869件**。割り当て漏れ・3本間の重複は**0件**。
- 企業TechBlogとZennで重なる**75記事は企業TechBlogだけに掲載**。
- RSSの通知日時、本文の元記事日時、購読ページ、日次統計も確認済みです。

[対象GHA](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/actions/runs/36535555250)、CI、外部テストはいずれも成功しています。

ただし、元RSSではメルカリが403、HEARTBEATSが404、Preferred Networksが解析エラーでした。**漏れ0件は、今回取得できた集約対象記事の範囲です。**


---


dedup前後でどれくらい削減したか、おしえて



----

今回確認した生成分では、**延べ1,102件 → 869件となり、233件・21.1%削減**できています。

| 統合先 | dedup前 | dedup後 | 削減件数 | 削減率 |
|---|---:|---:|---:|---:|
| 企業TechBlog | 650 | 563 | **87** | 13.4% |
| Zenn | 349 | 223 | **126** | 36.1% |
| Qiita | 103 | 83 | **20** | 19.4% |
| **合計** | **1,102** | **869** | **233** | **21.1%** |

Zennの126件の内訳は、**Zenn内の重複51件＋企業TechBlog側に配信した75件**です。

記事そのものは削っておらず、ユニーク記事869件はすべて残っています。なお、これは生成時の入力カテゴリとの比較で、Slackの実測通知回数ではありません。



----



dedupの履歴は何日前まで見てくれるの？


----


**最後に取得してから90日間**、重複判定の履歴を保持します。

- 同じ記事を再取得すると、そこからさらに90日間保持します。
- その間は、別タグや別カテゴリに登場しても、最初の配信先・通知日時を維持します。
- 90日間取得されず履歴が消えた後に再登場すると、新着扱いになる可能性があります。

なお、**RSSへの掲載保持は別**で、入力から消えた記事も最後の取得から14日間残します。


---


履歴はどこで持ってるの？


---



公開サイトの **[`feeds/delivery/state.json.gz`](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/delivery/state.json.gz)** に保存しています。GitHubの`gh-pages`ブランチで保持されます。

保存するのは、記事URLの識別キー、配信先RSS、初回掲載日時、最終取得日時、GUIDなどです。

次のGHAでは公開済みの履歴を復元して重複判定し、更新した履歴をRSSと一緒に公開します。**Actions Cacheは重複判定の正本には使いません。**


----


ghaの無料枠とか大丈夫？



----


**実行時間の無料枠は大丈夫です。ただし、キャッシュ容量は整理した方がよい状態です。**

このリポジトリは**Public＋標準Ubuntuランナー**なので、実行時間は無料です。Private向けの「月2,000分」を気にする必要はありません。[GitHub公式](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

確認できた使用状況は以下です。

| 項目 | 現状 |
|---|---|
| 直近の生成・デプロイ | ランナー稼働約4分15秒 |
| フィード生成処理 | 約39秒。翻訳・dedupを含む |
| 配信履歴全体 | 約9.9 MB |
| Actions Cache | **約10.15 GiB・27個** |
| 保存中の成果物 | 約6.4 GiB・48個。保持期間1日 |

キャッシュは標準上限の10 GiB付近です。通常は古いキャッシュが自動削除されます。上限を有料で拡張した場合は超過分が課金対象です。[キャッシュの公式仕様](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#usage-limits-and-eviction-policy)

容量の主因は、**実行ごとに保存するフィード・画像キャッシュ23世代、約9.7 GiB**です。dedupの90日履歴は`gh-pages`に保存する小さなファイルなので、主因ではありません。

おすすめは、**フィードキャッシュを直近2〜3世代に整理する仕組み**です。翻訳モデル用キャッシュと配信履歴は保持します。

なお、請求額はBillingの参照権限不足で確認できていないため、アカウント全体の請求がゼロとは断言していません。設定変更や削除は行っていません。



-----


キャッシュは追加課金される？




-----



**有料でキャッシュ上限を10 GiBより大きく設定した場合に、10 GiB超過分が課金されます。**

標準上限のままなら、容量が増えると古いキャッシュが自動削除されます。**先ほどの約10.15 GiBという表示だけでは、追加課金されているとは判断できません。** 削除処理が追いつくまで、一時的に上限を超えることがあります。[GitHub公式](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#usage-limits-and-eviction-policy)

このリポジトリの有料拡張設定はAPIで確認できませんでしたが、こちらでは上限変更を行っていません。




----



このカテゴリの並び順、整理したい
my-docs/CleanShot 2026-09-29 at 17.05.33@2x.png



----


ナビと登録フィード一覧を、次の順に整理しました。

**ALL → dedup3本 → 企業・個人ブログ → AI・開発 → クラウド → セキュリティ → Zenn・Qiita → ニュース → 資料・書籍 → 日次統計**

翻訳版は原文カテゴリの直後です。

テスト358件、lint・依存監査・サイトビルドが通っています。push後に公開ページへ反映されます。



---



it mediaも重複する可能性ある？


----



はい。**ITmedia内でも、他カテゴリとの間でも重複します。**

以前の取得履歴の調査では、以下を確認しています。

| 組み合わせ | 共通記事数 |
|---|---:|
| ITmedia総合RSS × ITmedia AI＋ | 14件 |
| ITmediaカテゴリ × karaageAI情報 | 28件 |
| ITmediaカテゴリ × Menthas | 11件 |
| ITmediaカテゴリ × はてブ | 9件 |

現在、karaageAI情報は**企業TechBlog dedup**に含まれるため、**企業TechBlog dedupとITmediaを両方購読すると、同じ記事が届く可能性があります。** ITmediaは現在の3本の共通重複排除には含まれていません。

なお、ITmedia内の重複だけなら、個別RSSをこのリポのITmedia集約RSS1本へ置き換えることで除外できます。企業TechBlogとの重複もなくすには、ITmediaも共通の配信履歴で判定する対象に加える必要があります。




------

menthas、はてぶも加えましょう
it media内のマージ・dedup rss
mentas dedup
はてブ dedup
をつくって、共通dedup判定に載せましょう


-----


追加しました。**6本で共通のdedup判定**を行います。既存の配信先・日時・GUIDも引き継ぎます。

push後に公開される新RSSは以下です。

```text
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/itmedia-dedup/feeds/rss.xml
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/menthas-dedup/feeds/rss.xml
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/hatena-dedup/feeds/rss.xml
```

ページ・日次統計も対応し、テスト361件、lint・依存監査・サイトビルドが通っています。公開データを使った移行検証でも、入力944記事の重複・割り当て漏れは0件でした。

公開確認後、Slackの元RSS登録を上記へ置き換えてください。



----



pushしたのでjob監視してください



----




**生成・デプロイ・Pages公開まで成功しました。** [対象ジョブ](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/actions/runs/36544098359)

新しいRSSも公開されています。

| RSS | 掲載件数 |
|---|---:|
| [ITmedia dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/itmedia-dedup/feeds/rss.xml) | 42 |
| [Menthas dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/menthas-dedup/feeds/rss.xml) | 16 |
| [はてブ dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/hatena-dedup/feeds/rss.xml) | 21 |

確認結果：

- 今回取得したユニーク記事**926件を、漏れ・重複なく6本へ配信**。
- 既存869記事の**配信先・通知日時・GUIDを維持**。
- ナビの並び順、購読リンク、日次統計も反映。
- CI・外部テストも成功。

Slackでは、元のITmedia・Menthas・はてブの登録を上記RSSへ置き換えられます。



----



これで、dedupがまだ不十分なカテゴリってある？



----



はい。**6本のdedup内では重複0件ですが、対象外のカテゴリとの重複が残っています。**

公開中のRSSを比較したところ、次の4カテゴリで確認できました。

| カテゴリ | dedup版と共通する記事数 | 重複先 |
|---|---:|---|
| **テクノエッジ** | **25件** | 企業TechBlog dedup |
| **個人ブログ** | **17件** | 企業TechBlog・はてブ dedup |
| **GIGAZINE** | **4件** | はてブ・Menthas dedup |
| **セキュリティ** | **4件** | はてブ・Menthas dedup |

※18:09 JST更新分の掲載記事で比較。過去の保持分も含み、当日の通知回数ではありません。

特に注意したいのは、**ITmediaのセキュリティ系RSSは「セキュリティ」カテゴリにあり、ITmedia dedupの入力には含まれていない**点です。現在のITmedia dedupは「総合・AI＋」を対象としています。

ほかにも、対象外カテゴリ同士で以下を確認しています。

- AI ↔ Hacker News：1件
- Engineering ↔ Hacker News：1件
- セキュリティ内：AI Security Daily DigestとSecurity NEXT・piyologに共通記事あり

**次に共通dedupへ加えるなら、テクノエッジ・個人ブログ・GIGAZINE・セキュリティの4カテゴリが優先候補です。** 原文RSSと翻訳RSSを両方購読した場合の重複は、これとは別に残ります。


---


it media セキュリティって
slack listもそうだっけ？

----



はい。[Slack登録一覧](/Users/fuhitonakagawa/my-tech-blog-rss-feed/my-docs/scripts/slackrss-list.md:29)でも、リポジトリと同じ区分です。

| RSS | Slack投稿先 |
|---|---|
| ITmedia 総合 | `#it-media-feed` |
| ITmedia AI＋ | `#it-media-feed` |
| ITmedia NEWS セキュリティ | `#security-feed` |
| ITmedia エンタープライズ「セキュリティ」 | `#security-feed` |
| TechTargetジャパン セキュリティ | `#security-feed` |
| ＠IT Security&Trust | `#security-feed` |

したがって、**ITmedia dedupだけでは、`#security-feed`側との重複は除外されません。**



----


ちなみに、いまのslack listから、dedupに置き換える事ができるチャンネルの対応を知りたいです
それらが完全に抜けもれなくカバーされることは確認してください



----



確認しました。**登録定義上は、対象14チャンネルの140本をすべてカバーしています。** 対応は以下です。

| 現在のSlackチャンネル | 登録RSS数 | 置き換え先 |
|---|---:|---|
| `#my-tech-blog-jp-feed`<br>`#company-tech-blog-feed`<br>`#karaage-ai-news-feed` | 94＋1＋1＝**96本** | [企業TechBlog dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/tech-blog-dedup/feeds/rss.xml) |
| `#zenn-trend-feed`<br>`#zenn-ai-feed`<br>`#zenn-cloud-feed`<br>`#zenn-security-feed` | **20本** | [Zenn dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/zenn-dedup/feeds/rss.xml) |
| `#qiita-trend-feed`<br>`#qiita-ai-feed`<br>`#qiita-cloud-feed`<br>`#qiita-security-feed` | **20本** | [Qiita dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/qiita-dedup/feeds/rss.xml) |
| `#it-media-feed` | **2本** | [ITmedia dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/itmedia-dedup/feeds/rss.xml) |
| `#menthas-feed` | **1本** | [Menthas dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/menthas-dedup/feeds/rss.xml) |
| `#hatenab-feed` | **1本** | [はてブ dedup](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/hatena-dedup/feeds/rss.xml) |

各行を1つのチャンネルにまとめ、対応するdedup RSSを1本登録する構成です。

確認結果は次のとおりです。

- Slack一覧とdedup入力を双方向に照合し、**登録元の不足・余分ともに0本**。
- HTTP→HTTPSの転送、日本語URLのエンコード差も照合済み。
- 公開済みの取得対象記事**926件→926件**で、割り当て漏れ・重複ともに0件。

ただし、**カバーするのは6本全体です。** 例えばITmediaの記事が企業TechBlogで先に配信されていれば、ITmedia dedupでは再配信しません。

また、メルカリ・HEARTBEATS・Preferred Networksには元RSSの取得失敗があります。巡回前にRSSから消えた記事や集約対象の8日間を超える記事もあるため、**登録元140本の網羅は確認済みですが、全記事の通知を完全に保証するものではありません。**



----



dedup系は1時間おきバッチで数件投稿してますか？
何件くらい来てます？



-----



はい。**基本は平日1時間おき・週末2時間おきに生成し、新着を1記事ずつ配信**します。JST 0時にも実行し、1〜7時台は定期実行がありません。Slackには、その後の巡回でまとまって届く形です。

初回の大量掲載を除いた、**今日18〜22時台の直近5回**では以下でした。

| dedup RSS | 1回あたり平均 | 最少〜最多 |
|---|---:|---:|
| 企業TechBlog | 4件 | 0〜10件 |
| Zenn | 7件 | 0〜21件 |
| Qiita | 5.2件 | 0〜14件 |
| ITmedia | 1.8件 | 0〜7件 |
| Menthas | 0.6件 | 0〜2件 |
| はてブ | 1.8件 | 0〜5件 |
| **6本合計** | **20.4件** | **0〜40件** |

合計は順に **11 → 20 → 31 → 40 → 0件**でした。固定件数ではなく、その回に初めて見つかった記事数です。

※これは**RSS上の新規配信件数**で、Slackの実測通知数ではありません。まだ5回分なので、長期的な平均とは分けて見てください。



---

2時間おきの時間帯を1時間に変えても、コストは変わらない？無料のまま？なら、いつでも1時間おきに変えたい


----


**実行時間は無料のままです。** 公開リポジトリ＋標準Ubuntuランナーが対象です。[GitHub公式](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

**全曜日・24時間、毎時0分（1日24回）**に変更しました。深夜・週末も通常・翻訳・dedupフィードを生成します。実際の起動には遅延があります。

テスト361件、lint、ワークフロー検証、依存監査は通過済みです。**push後に有効になります。**

なお、成果物・キャッシュの保存量は増えます。実行時間の無料条件とは別で、有料の容量拡張設定は変更していません。



----

これはいってますか？
https://tech.akariinc.co.jp



----


はい。**yamadashy版経由で、企業TechBlog dedupの対象に入っています。**

- 登録名：**燈**
- 元RSS：`https://tech.akariinc.co.jp/feed`
- このリポジトリへの単体登録：なし
- [yamadashy版の登録定義](https://github.com/yamadashy/tech-blog-rss-feed/blob/main/src/resources/feed-info-list.ts)

現在の最新記事は**8月24日公開**で、集約対象の過去8日間から外れているため、今の配信記事には表示されていません。


----
