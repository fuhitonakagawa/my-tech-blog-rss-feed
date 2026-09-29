pushしたので、実行結果を待ちます。
待っている間に以下の調査します
今見たら、元フィードと翻訳で件数が一致してないんだけど、なんで？
抜け漏れある？実行時間間隔の問題？

# my-tech-blog-ai-feed
5 件のメッセージ
Esc を押して
OpenAI News
アプリ  03:15
The Lenfest Institute grows landmark program with expanded OpenAI support
OpenAI is expanding the Lenfest AI Collaborative and Fellowship Program with $5 million in funding and up to $5 million in software credits and engineering support.

OpenAI
The Lenfest Institute grows landmark program with expanded OpenAI support
OpenAI is expanding the Lenfest AI Collaborative and Fellowship Program with $5 million in funding and up to $5 million in software credits and engineering support.
OpenAIOpenAI

AI
アプリ  04:24
Watch the winning trailer from the Future Vision XPRIZE, The Gifted.
Watch the winning trailer from the Future Vision XPRIZE, The Gifted.

Google
Watch the winning trailer from the Future Vision XPRIZE, The Gifted.
Watch the winning trailer from the Future Vision XPRIZE, The Gifted.
GoogleGoogle | 昨日の16:00

Microsoft Research
アプリ  07:03
One year in: How Microsoft Research Asia – Singapore is advancing research, partnership and talent for real-world impact
Since launching a year ago, the Microsoft Research Asia — Singapore lab has established a strong foundation, deepened collaboration across government, academia, and industry, and explored how frontier AI research can create real-world value.
The post <a href="https://www.microsoft.com/en-us/research/blog/one-year-in-how-microsoft-research-asia-singapore-is-advancing-research-partnership-and-talent-for-real-world-impact/">One year in: How Microsoft Research Asia – Singapore is advancing...

Microsoft Research
Singapore lab builds connections, drives frontier research in year one
Since launching a year ago, the Microsoft Research Asia — Singapore lab has established a strong foundation, deepened collaboration across government, academia, and industry, and explored how frontier AI research can create real-world value:
Microsoft ResearchMicrosoft Research | 今日の06:00

Anthropic Newsroom
アプリ  08:52
Introducing Claude Sonnet 5.5
A clear upgrade over Sonnet 5 that runs 30% faster and costs up to 30% less for most work.

anthropic.com
Introducing Claude Sonnet 5.5
Claude Sonnet 5.5 is a clear upgrade over Claude Sonnet 5, runs 30%+ faster, and costs up to 30% less for most work.
anthropic.comanthropic.com

OpenAI News
アプリ  11:35
How we will do better for Australia
OpenAI apologizes for incidents involving Australian government websites and outlines stronger safeguards and support to strengthen Australia’s cyber defences.

OpenAI
How we will do better for Australia
OpenAI apologizes for incidents involving Australian government websites and outlines stronger safeguards and support to strengthen Australia’s cyber defences.
OpenAIOpenAI


# my-tech-blog-ai-feed-translated-jp
2 件のメッセージ
Esc を押して
AI - Translated Japanese｜企業テックブログRSS
アプリ  09:18
先物ビジョンXPRIZEから受賞したトレーラーを見ると、ギフト。 | AI
先物ビジョンXPRIZEから受賞したトレーラーを見ると、ギフト。

Google
Watch the winning trailer from the Future Vision XPRIZE, The Gifted.
Watch the winning trailer from the Future Vision XPRIZE, The Gifted.
GoogleGoogle | 昨日の16:00

09:18
マイクロソフト・リサーチ・アジア – シンガポールは、現実世界の影響のための研究、パートナーシップ、才能を発展させています | Microsoft Research
マイクロソフトリサーチアジアは1年前に立ち上げたシンガポールラボは、政府、アカデミー、業界を横断する強力な基盤、深みのあるコラボレーションを確立し、より前方AIの研究が現実世界の価値を創造できるかを探求しました。 投稿について マイクロソフト・リサーチ・アジア – シンガポールは、マイクロソフト・リサーチ・リサーチに初めて登場する現実的なインパクトのための研究開発、パートナーシップ、才能を発展させ





------


**今回の5記事は、すべて翻訳RSSにあります。生成側の欠落ではなく、Slackの通知側で3件が出ていません。**

原文・翻訳RSSはともに70件で、記事URLも一致しています。

| 記事 | RSS上の公開日時（日本時間） | 翻訳RSS | 翻訳Slack |
|---|---|---|---|
| Lenfest | 9/28 16:00 | あり | なし |
| Google・The Gifted | 9/29 04:00 | あり | 09:18に通知 |
| Microsoft・Singapore | 9/29 06:00 | あり | 09:18に通知 |
| Claude Sonnet 5.5 | 9/28 09:00 | あり | なし |
| OpenAI・Australia | 9/29 04:00 | あり | なし |

**原因は、Slackの「日付による新着判定」と考えられます。**

Slackは、前回取得した記事の日付を保存し、次回はそれより新しい日付の記事だけを通知します。[Slack公式説明](https://slack.com/help/articles/218688467-Add-RSS-feeds-to-Slack)

例えばAustraliaの記事は、原文チャンネルへの到着が11:35でも、RSS上の日時は04:00です。翻訳チャンネルでは09:18に「06:00公開」のMicrosoft記事を通知済みなので、後から追加された04:00の記事が対象外になる状況と一致します。内部の判定値までは確認できませんが、**待つだけでは通知されない可能性があります。**

実行間隔による遅れもあります。深夜1〜7時は定期生成がないため、夜間の記事は朝まで待ちます。ただし、今回の通知漏れは間隔を短くするだけでは解消できません。

対策は、**Slack向けRSSでは初回掲載時刻を通知用の日付に使い、元記事の公開日時は別に保持する設計**です。通常RSSや日次統計の公開日基準は維持できます。

今回のpushは[Actions](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/actions/runs/36518802200)・Pagesとも成功し、**57カテゴリとRSS別内訳の公開反映まで確認できました。**



---

slackの問題？slackって全部のRSS通知してくれないの？


----


SlackのRSSアプリは、未通知の記事を必ず全部届ける仕組みではありません。

「記事IDが未通知か」ではなく、前回取得した記事の日付より新しいかで取得対象を判断します。Slack公式説明

例えば：

06:00公開の記事を通知
後から、04:00公開の記事がRSSに追加される
04:00の記事は未通知でも対象外になり得る

今回のように複数サイトを1本に集約すると、取得の遅れや配信元の更新タイミングによって、この日付の逆転が起きます。個別RSSでも起こり得ますが、集約RSSでは特に起きやすくなります。

つまり、Slackの仕様と、元記事の公開日時を維持する現在の集約方式の組み合わせによる問題です。翻訳RSSには5件とも存在しています。

先ほど「翻訳版だけで原文チャンネルを置き換えられる」と説明しましたが、取得元の一致だけで通知の網羅性まで保証する説明になっていました。そこは訂正します。


----


修正します



今の実装は、翻訳版の生成日付を、元記事の生成日時に改ざんして投稿していたってこと？


----


挙動としては、翻訳版RSSの記事日時に、翻訳した時刻ではなく元RSSの公開日時を使っていました。

例えば「04:00公開の記事を12:00に翻訳」した場合、翻訳版RSSのpubDateも04:00になります。翻訳日時を後から書き換えたのではなく、原文の公開日時をそのまま引き継ぐ実装でした。

記事を時系列で読むには自然ですが、Slackの通知判定とは相性が悪く、遅れて翻訳版に載った記事が通知されない原因になります。Slack用の初回掲載日時を別に管理しなかった設計の不備です。 修正では、元記事の公開日時を保持したうえで、Slack向けRSSの通知日時を分けます。


----


その他自家製feedを作っているところは、投稿日時は自家製feedの生成時刻として、別で元記事の投稿時刻がわかるように鳴っていると良いかな？
メタデータ的なのをつけたらslackで通知は投稿軸で、ただし表示時刻は元記事になるように表示できるとかある？あるいは、タイトルの末尾とか本文先頭に元記事時刻を書くとか、どういう工夫ができる？
slackで抜け漏れなく通知されるようにしたい



----


はい。独自生成・翻訳・統計も、Slack向け版では同じ方式に揃えるのがよいです。

ただし、通知日時は毎回の生成時刻ではなく、その記事を初めて掲載した時刻に固定します。毎回更新すると、同じ記事が繰り返し通知される可能性があります。

元記事の日時は、**本文の先頭に「元記事公開：9/28 16:00 JST」**のように明記する方針にします。タイトルは記事名だけに保ちます。独自メタデータだけでSlackの表示日時を切り替えられるかは、公式仕様を確認します。


----


translated 以外の自家製feedも確認してね


----


はい。翻訳版だけでなく、次の自家製RSSすべて、計63本を確認対象にしています。

HTMLから生成する単独RSS：4本
通常カテゴリの集約RSS：44本
翻訳カテゴリRSS：13本
全体集約RSS：1本
日次統計RSS：1本

それぞれにSlack用の配信先を用意し、後着記事の通知日時・元記事日時の表示・再生成時の重複通知を検証します。




**翻訳以外も含め、自家製RSS63本すべてで確認しました。**

- 通知日時：記事を**初めて掲載した時刻**に固定
- 元記事日時：本文先頭に表示
- 再生成：同じ記事の日時・GUIDを維持
- 通常RSS・日次統計：元記事の公開日基準を維持

表示例：
```text
元記事公開：2026/9/28 16:00:00（日本時間）

記事の概要…
```

**公開後、Slackの登録URLを専用URLへ切り替える必要があります。** AI翻訳版なら：
```text
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/slack/rss/ai-jp/feeds/rss.xml
```

ページのSlackコピー欄も専用URLに変更しました。テスト334件、依存監査、63本の生成・再生成検証は成功しています。

未pushです。今回の日付逆転による通知漏れを防ぐ対応で、既に漏れた記事の遡及通知は別途必要です。


----


え、なんでURL変える必要があったの？

---


readmeに以下のように記載あるけど、既存URLって何？READMEだけ読んでる人に意味伝わる？


- **Slack向けRSS**: 全体・通常カテゴリ・翻訳カテゴリ・HTML由来RSS・日次統計に、既存URLで初回掲載順のRSSを提供します。元記事の公開日時は本文の先頭に表示します。



----

その通りです。「既存URL」は変更前の経緯を知らないと意味が伝わりません。READMEでは経緯に依存せず、RSSの日時と配信先の仕様を説明する文に直します。



----


変更前のというか、このリポでgenerateする自家製Feedの仕様そのものを変えた、ということであってますか？もともとは単に集約して投稿日時は元RSSの日時を採用していたけど、自家製の生成日時をそのまま採用して元フィード日時はボディに書くようにした、で正確ですか？すべてのgeneratedがそれ？その仕様はどこかにまとめてないの？



----



概ねその理解で合っています。ただし、採用するのは毎回の生成日時ではなく、その記事を自家製RSSへ初めて掲載した日時です。再生成しても通知日時は更新しません。

対象は、このリポジトリが配信するRSS全63本です。元記事の公開日時は本文先頭に記載し、Atom・JSON Feed・画面表示・日次統計では引き続き元記事の日時を使います。

仕様はREADMEの「5.6. RSSの通知日時と元記事日時」にまとめています。対象形式と初期化時の扱いも、そこだけで理解できるよう明記します。


----

はい。**このリポジトリで生成するRSSそのものの、日時の仕様変更です。**

正確には、毎回の生成時刻ではなく、**その記事を当該RSSへ初めて掲載した時刻**を使います。

例：

- 元記事公開：04:00
- 自家製RSSへの初回掲載：12:00 → `pubDate`は12:00
- 13:00に再生成 → `pubDate`は12:00のまま
- 本文先頭に「元記事公開：04:00」と表示

**全63本のRSSが対象**です。全体集約・通常カテゴリ・翻訳カテゴリ・HTML由来・日次統計を含みます。Atom・JSON Feed・画面表示・日次集計は、元記事の日時を維持します。

仕様は[README「5.6. RSSの通知日時と元記事日時」](/Users/fuhitonakagawa/my-tech-blog-rss-feed/README.md:439)に、対象形式・具体例・保持期間・履歴復元までまとめました。

なお、公開済みの記事は一斉再通知を避けるため、日時・GUIDを引き継ぎます。**購読URLは変更しません。** 修正と336件のテスト、サイト生成を確認済みです。



-----

my-docs/scripts/slackrss-list.md
にある
slackで配信しているもののうち、
このリポ由来で使用しているものってなに？
原産Feedを使っているものは、slackで時刻前後で通知されない、とはならないよね？
そして今回の変更で、このリポ由来Feedも通知漏れは起きなくなったという理解で良い？


----

`slackrss-list.md`の330本中、**このリポジトリ由来は18本**です。

| フィード | 投稿先 |
|---|---|
| Serverless Operations | `#my-tech-blog-jp-feed` |
| Anthropic Newsroom | `#my-tech-blog-ai-feed` |
| Claude Code Blog | `#my-tech-blog-ai-feed` |
| Claude Product announcements | `#my-tech-blog-ai-feed` |
| 日次投稿統計 | `#daily-stats` |
| 翻訳版13本 | 各`*-translated-jp`チャンネル |

翻訳版13本は、**AI、AWS、Azure、Google Cloud、Database、Engineering、Platform、Programming、Robotics、Security Advisory、Security、TechCrunch、Hacker News**です。

**配信元のRSSを直接購読していても、日時による通知漏れは起こり得ます。**

配信元が古い公開日時の記事を後からRSSへ追加した場合、Slackは通知済みの記事より古いとして除外する可能性があります。これは集約RSSだけの問題ではありません。[Slack公式仕様](https://slack.com/help/articles/218688467-Add-RSS-feeds-to-Slack)

また、残り312本には、karaageのAI情報・企業テックブログRSS・Hacker Newsまとめなど、**他者が生成する集約フィード**も含まれます。

**今回の修正で防ぐのは、「取得して掲載した記事が、古い公開日時のためSlackに通知されない」という漏れです。** このリポ由来の18本も、公開後はその対策が適用されます。URL変更は不要です。

ただし、以下まで「必ず届く」とは保証できません。

- 元RSSから取得できなかった記事
- Slack側の取得失敗や配信制限
- 保持期間を超えてSlackが取得しなかった記事
- 修正前にすでに通知対象外になった記事の遡及通知

したがって、**今回判明した日時逆転の問題には対策済み。ただし、あらゆる通知漏れを保証する仕組みではない**、という理解が正確です。



----


変更はpushしたので、再生成されるページで日時が修正されていることを確認監視してください


----




**公開反映まで確認できました。** コミット`8199ca6`の[後続実行](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/actions/runs/36524653359)とPagesは成功しています。

公開RSSで確認した実例です（日本時間）。

| 項目 | 日時 |
|---|---|
| 元記事の公開日時 | 9/28 22:30:54 |
| RSSの通知日時 | **9/29 14:04:28** |
| 本文先頭 | 元記事公開：9/28 22:30:54 |

- **全63本・5,672項目**のRSSを解析して確認
- JSON・Atom・ページ表示・日次統計は元記事日時を維持
- 後続の再生成でも、掲載済み項目の通知日時・GUIDは変化なし
- 購読URLも変更なし

push実行はデプロイ成功後に定期実行へ切り替わってキャンセル表示ですが、同じコミットの後続実行・公開まで正常に完了しています。