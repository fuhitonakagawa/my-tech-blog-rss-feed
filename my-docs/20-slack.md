


hacker newsに以下のslack rssがありましたが、translated jpがありません

Hacker News - Japanese  [21:19]
New Cyber-OSINT model released
:memo: Md Ismail Šojal :spider:@0x0SojalSecThe Cyber-OSINT model that You can run locally. Md Ismail Šojal :spider:@0x0SojalSec11ha 7B cyber model that fits on locally 8GB GPU. Most security model are a system prompt.

:link: Read more: https://twitter.com/0x0SojalSec/status/2104736980768866439
Md Ismail Šojal :spider: (@0x0SojalSec) on XThe Cyber-OSINT model that You can run locally.

- MoE (26B total, 4B active, 262K ctx) trained on 6,500 OSINT/CTI instructions.
- SFT for cyber threat intel and investigative work.
- Threat-actor attribution. 
- IoC pivoting. Geolocation. 
- Admiralty source grading.
- 262K context.x.com[21:19]US sanctions force The Netherlands off Microsoft and toward alternative NixOS
:memo: It was then that the Dutch government decided that it was time to make plans that would reduce its reliance on software and services that were made or based in the United States. That system is built around NixOS, with three service providers tasked with the job. That alone means that the setup is incredibly easy to reproduce across multiple machines, something that is an obvious benefit when dealing with different facets of a government.

:link: Read more:...
Tom's HardwareUS sanctions force The Netherlands off Microsoft and toward alternative NixOS-based software ecosystem — trial programs running now, first release expected at end of 2027The U.S. imposed sanctions on the International Criminal Court, preventing it from using ubiquitous U.S.-based software.Tom's Hardware | 今日の02:00[21:19]Evan Doorbell's Phone Tapes – Brought to You by Telephone World
:memo: Evan Doorbell’s Phone Tapes Evan Doorbell’s Phone Tapes are a well known “documentary” of how the phone system used to be like in the 1970s. This material is copyrighted by Evan Doorbell. Production Tapes Production tapes are phone trip tapes that Evan Doorbell has narrated with full descriptions.

:link: Read more: https://evan-doorbell.com/
[21:19]Startup Nights 2026 is comming up on 5-6 Nov. in Switzerland
:memo: What to expect at Startup Nights Startup Nights is the annual meetup of the Swiss startup ecosystem. Get Your Tickets Now Don’t miss out on Startup Nights 2026. Secure your spot today.

:link: Read more: https://www.startup-nights.ch/event/
startup-nights.chStartup Nights – The biggest startup event in SwitzerlandStartup Nights is the annual meetup of the Swiss startup family. Expect two packed days full of keynotes, workshops, pitchstartup-nights.ch[21:19]500k facial scans at UK stations yield no arrests, 1 false positive
:memo: More than half a million faces were scanned in some of the capital’s busiest transport hubs during the trial. More than half a million faces were scanned between February and July this year in some of the capital’s busiest transport hubs during the British Transport Police (BTP) trial of the surveillance technology, which aimed to help catch offenders and people breaching court orders. Success for the police trying to catch people means people being caught.

:link: Read more:...
the GuardianTrial of live facial recognition in London stations leads to a false positive and no arrestsFreedom of information request finds six-month trial cost £320,000, used almost 100 police hours and led to just one – incorrect – alertthe Guardian | 今日の18:48[21:19]Using any C++ library in Godot
:memo: 0, a single godot-cpp release works with any Godot version from 4. An extension built for Godot 4. debug = "res://bin/libgdexample.

:link: Read more: https://blog.conan.io/cpp/conan/gamedev/godot/cmake/2026/09/29/Using-Any-Cpp-Library-In-Godot.html
blog.conan.ioUsing any C++ library in GodotHow Godot's GDExtension system and the godot-cpp bindings work, and how to use Conan to bring C and C++ libraries into a Godot game, with a flecs example that simulates 100,000 particles.blog.conan.io[21:19]Jeeves. Reasoning improves Jev-like decision models
:memo: Jeeves – Reasoning improves Jev-like decision models A reasoning Jev-style classifier with a diffusion drafter, trained with SFT and CISPO. 746 JevBench overall (231 public items) 0. 055 JevBench hard (111 public items) 0.

:link: Read more: https://github.com/PostHog/jeeves
GitHubGitHub - PostHog/jeeves: Jeeves – Reasoning improves Jev-like decision modelsJeeves – Reasoning improves Jev-like decision models - PostHog/jeevesGitHub[21:19]AI companies leak data to advertisers [pdf]
:memo: ;��|>�m��T�߰����@�-q� ���&�3 OB$�fqj^q�4�MtuK�x������B��� W��@�p(Į�D��O�Kn> stream x��[ߓ���~�_᷋��  /���nN�$'�dr~T��͌���50��_��-.

:link: Read more: https://jorgegarciaherrero.com/wp-content/interactivos/20260916-Prompt-like-a-butterfly-sting-like-a-tracker-(clean).pdf
[21:19]You Are No Longer Invited to Dinner
:memo: Until 1975, half of Americans said they entertained guests at their home every month. Americans stopped throwing parties. The share of Americans saying they never entertained people at home tripled.

:link: Read more: https://www.derekthompson.org/p/the-death-of-the-american-hostderekthompson.orgYou Are No Longer Invited to DinnerWe’re witnessing the death of hosting in America. The share of adults who say they regularly have friends over has declined 70 percent since 1975derekthompson.org




----


確認しました。**提示された9記事は、翻訳RSSに掲載されていません。Slack側ではなく、このリポジトリでの取り込みが原因です。**

原因は2段階ありました。

1. **キャッシュによる遅延**
   21:11に取得した後、元RSSが21:13に更新。22:10の取得では1時間キャッシュが約36秒残っていたため、古い内容を再利用しました。

2. **再取得時の検証エラー**
   22:54の実行では再取得しましたが、PDF記事「AI companies leak data to advertisers」の文字化けした概要に、制御文字 **`U+007F`が2個**含まれていました。これにより、**正常な8記事も含めてRSS全体が拒否**されています。[該当ジョブ](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/actions/runs/36578554890)

つまり、**毎時実行にして待つだけでは解消しません。**

対処としては、不正な概要を切り離してタイトル・URLと正常な記事を取り込めるようにすることと、毎時実行に対して長すぎるRSSキャッシュを短縮することが必要です。



----


はい、バグを除いてください。そのほか類似でエラーになりそうなところはバリエーション考えて、対処してください



----


修正しました。**提示された9記事すべてを、ローカルで翻訳RSS・ページへ出力できることを確認しています。**

- 壊れた概要・本文だけを除き、タイトル・URL・GUID・公開日時を保持。
- URLやGUIDなどが壊れた場合は、その記事だけを除外。
- CDATA、文字参照、Atom、RSS 1.0などの類似ケースにも対応。
- XML構造の検証は維持。
- RSSキャッシュを**60分→15分**へ短縮し、破損キャッシュは再取得。

内部テスト**404件**、lint・型チェック・依存監査、全体生成・サイトビルドが通っています。READMEとAGENTS.mdにも仕様を記載しました。

**公開反映にはpushが必要です。**


----

platform enでは今日のslack rss投稿は以下です

GitLab  [03:18]
What's new in Git 2.56.0?
The Git project recently released Git 2.56.0. Let's look at some of the highlights of the release, including contributions from the Git team at GitLab.What's covered:<a href="https://about.gitlab.com/blog/whats-new-in-git-2-56-0/#git-merge-2026-and-schedule-for-git-30">Git Merge 2026 and schedule for...GitLabWhat's new in Git 2.56.0?Learn about the new features and changes in the latest Git release, including a new git-history(1) drop command, git-refs(1) getting new subcommands to modify refs, linearizing history with git-replay(1), and more.GitLab | 昨日の09:00The GitLab HandbookGit TeamMission statement The Git team is responsible for building, maintaining and providing expertise on the Git version control system. Its main responsibilities include:
Upstream development of the Git version control system. Provide expertise to other teams at GitLab. Foster the Git community. Ensure the long-term viability of the Git project. Upstream development The Git team is responsible for driving the upstream development of Git both in accordance with the goals of the community and to address GitLab-specific needs as raised by other teams. This falls into the following broad categories:The GitLab Handbook



一方trans jpは以下です

Platform - Translated Japanese｜企業テックブログRSS  [17:25]
HashiCorp Boundaryの安全なAIエージェント | HashiCorp Blog
元記事公開：2026/9/29 16:00:00（日本時間）

企業のアイデンティティ、アクセス、および監査制御内での運用中に、AIエージェントがリソースを安全にアクセスできるようにします。




roboticsカテゴリfeedは

The Robot Report  [03:21]
Gecko Robotics works with NVIDIA to add AI agent security and control
Gecko Robotics is using the new NVIDIA Open Agent Safety Platform to ensure the secure autonomous control of systems.
The post Gecko Robotics works with NVIDIA to add AI agent security and control appeared first on The Robot Report.
The Robot ReportGecko Robotics works with NVIDIA to add AI agent security and control - The Robot ReportGecko Robotics is using the new NVIDIA Open Agent Safety Platform to ensure the secure autonomous control of systems.Written byEugene DemaitreEst. reading time6 minutesThe Robot Report | 今日の02:41IEEE Spectrum  [07:18]
A Day in the Life of a Roboticist: Charlie Kemp
Building useful robots starts with understanding the people who use them. For Charlie Kemp, cofounder and chief technology officer of Hello Robot, that means developing assistive robots that can help people with everyday tasks and support greater independence.In this Robots Guide profile, Kemp shares his path from studying artificial intelligence at MIT to building Stretch, explains how working with people with disabilities has shaped his...ROBOTS: Your Guide to the World of RoboticsBuilding Assistive Robots to Help People Live IndependentlyDiscover how Hello Robot develops assistive robots to improve quality of life, what inspires the work, and advice for aspiring roboticists.ROBOTS: Your Guide to the World of Roboticsrobotsguide.comROBOTS: Your Guide to the World of RoboticsThe world's largest catalog of robots, drones, and self-driving cars, with thousands of photos, videos, tech specs, news, and information on how to get into robotics. Brought to you by IEEE Spectrum.robotsguide.com



translated jpは
Robotics - Translated Japanese｜企業テックブログRSS  [09:00]
閾値のロボノミクス: 経済自律性、スマートシティ、およびヒューマノイドのための暗号財布 | The Robot Report
経済は、ロボットのインペータスと制約の両方で、システムが通りに送ったり、家庭で雑把にしたりするからです。 閾値のロボノミクス: 経済自律性、スマートシティ、ヒューマノイドの暗号財布は、最初にロボットレポートに登場しました。[09:00]Gecko Roboticsは、AIエージェントのセキュリティと制御を追加するNVIDIAと連携 | The Robot Report
Gecko Robotics は、新しい NVIDIA Open Agent Safety Platform を使用して、安全な自動制御システムを保証します。 Gecko ロボティクスは、NVIDIA と連携して、AI エージェントのセキュリティと制御を初めてロボット レポートに追加します。[09:00]ロボティクスの人生の日: チャーリー・ケンプ | IEEE Spectrum
便利なロボットの構築は、使い慣れた人達の理解から始まります。 ハローロボットの共同創業者兼チーフ・テクノロジー・オフィサーであるチャーリー・ケンプは、日常のタスクで人々を助け、より大きな独立性をサポートする補助ロボットを開発することを意味する。 このロボットガイドのプロファイルでは、MITで人工知能を勉強し、ストレッチを構築するための彼の道を共有し、障害のある人々との作業がどのように彼のアプローチROBOTS: Your Guide to the World of RoboticsBuilding Assistive Robots to Help People Live IndependentlyDiscover how Hello Robot develops assistive robots to improve quality of life, what inspires the work, and advice for aspiring roboticists.ROBOTS: Your Guide to the World of RoboticsRobotics - Translated Japanese｜企業テックブログRSS  [23:10]
製造業におけるロボットの状態 | The Robot Report
元記事公開：2026/9/29 22:22:56（日本時間）

製造中のロボティクスの製造ロボットの進歩は、自動車製造ラインの厳しいプログラミングロボットアームの時代から進化しています。 ロボットモデルは、産業オートメーションの多様化、広範なアプリケーションは、知覚、自律性、行動の改善と変化しています。 また、熟練労働者の不足は、多岐に渡ります。 製造業のロボットのポストの状態は、ロボットレポートで最初に登場しました。The Robot ReportState of Robots in Manufacturing - The Robot ReportReport looks at advances in robots for manufacturing Robotics in manufacturing has evolved from the days of rigidly programmed robot arms on automotiveWritten byThe Robot Report StaffEst. reading time2 minutesThe Robot Report | 今日の22:22


なにがどうなってるの？



----


**今回は、挙げられた記事はすべて翻訳RSSにあります。** 翻訳の欠落ではなく、通知日の違いと、Slackでの未通知が混ざっています。

Slackの実投稿も確認しました。

| 記事 | 英語Slack | 翻訳Slack | 状況 |
|---|---|---|---|
| Git 2.56.0 | 今日03:18 | 見つからず | **翻訳済みだが未通知** |
| HashiCorp Boundary | **9/23 02:23** | 今日17:25 | 英語は以前に通知済み |
| Gecko Robotics | 今日03:21 | 今日09:00 | 両方届いている |
| Charlie Kemp | 今日07:18 | 今日09:00 | 両方届いている |
| Robonomics | 見つからず | 今日09:00 | 原文RSSにも存在。英語側の通知は未確認 |
| State of Robots in Manufacturing | 見つからず | 今日23:10 | 原文RSSにも存在。英語側の通知は未確認 |

**GitLabは、日時修正前の未通知が残っているケースです。**

翻訳RSSのタイトルは「Git 2.56.0の新機能は何ですか?」ですが、通知日時は今も**9/28 09:00**です。日時方式の切り替え時に、既存記事を一斉再通知しないため古い日時を引き継ぎました。

Slackは前回取得した記事日時より新しいものを取得する仕様なので、この古い記事は通常の再生成だけでは再通知されません。当初通知されなかった原因の断定にはSlack内部の履歴が必要ですが、**過去の取りこぼしを自動復旧できていない**ことは確かです。[Slack公式仕様](https://slack.com/help/articles/218688467-Add-RSS-feeds-to-Slack)

**HashiCorpは、英語では先週届いていました。**

[9/23の英語投稿](https://test-dej2512.slack.com/archives/C0BJX4NKPL4/p1790097824873919)があります。現在の元RSSはこの記事の`updated`を9/29 16:00としており、こちらはその日時で取り込んでいます。したがって、本文の「元記事公開：9/29 16:00」は、このケースでは厳密には**更新日時で、初公開日時ではありません**。

RoboticsのGecko・Charlie Kempが09:00にまとまったのは、当時、深夜の定期生成がなかったことによる遅延です。残る2記事の英語通知は、巡回待ちか日時判定による取りこぼしかまでは断定できません。

現在のRSS自体は、**Platformが原文41件／翻訳41件、Roboticsが原文20件／翻訳20件で、記事URLの差分は0件**です。ただし、RSSに存在することとSlackへの通知完了は別で、GitLabのような過去の未通知分には個別の再通知対応が必要です。



----


今日以降の通知文については未通知のまま放置されることはない？


----



**「今日以降は未通知のまま残らない」とまでは保証できません。** 以前の説明は、RSSへの掲載とSlackへの通知を分けて伝えるべきでした。

現在の履歴が管理しているのは、**RSSに掲載したかどうか**です。Slackへの通知完了を確認し、失敗分を再送する仕組みはありません。

今回の修正で、以下には対処しています。

- 後から取得した古い記事にも、新しいRSS通知日時を付ける
- 壊れた概要1件でフィード全体を落とさない
- キャッシュを15分に短縮する

**修正の公開反映も確認でき、Hacker Newsの9記事はすべて翻訳RSSに載っています。** ただし、元RSSからの取得漏れやSlack側の未通知まで防げるわけではなく、GitLabのような修正前の未通知も自動再送されません。

**未通知を放置しないためには、RSS掲載記事とSlackの実投稿を照合し、未通知を検出・再送する仕組みが別途必要です。**



----


slack上の話ですが、
はてぶdedupに元feedでは10時間前に投稿されたものがいまdedup側にでました。これはなんの問題？slack通知の問題ですか？



-----



slack通知とfeedそのものの時差は、日が経てば落ち着きますか？いまslack rssは登録追加したばっかりだからこうなっている？
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/hatena-dedup/
でみる限りはdedupと元で特に乖離ないので問題ないと思ってますが、slack通知への表示だけの問題で、これは時間経過で安定化しますか？



----



**「登録直後だから、数日待てば安定する」という話ではありません。ただ、直近の投稿ではSlackへの通知自体は約30秒で届いています。**

例として「Claude Sonnet 5.5」の記事は、次の時系列でした。

| 段階 | 時刻 |
|---|---|
| GIGAZINEチャンネルへの投稿 | 11:25 |
| はてブdedupへの初回掲載処理 | 23:25 |
| dedup RSSの公開反映 | 23:29:07 |
| [はてブdedupのSlack投稿](https://test-dej2512.slack.com/archives/C0C5EAHBPN0/p1790692177803889) | 23:29:37 |

つまり、**この例の長い時差はSlackの待ち時間ではなく、はてブdedupへの取り込み前に生じています。** GIGAZINEは共通dedupの対象外なので、GIGAZINE側で既読でも、後からはてブ経由で初めて配信されます。

また、Webページは**元RSSの記事日時**で並べ、Slackは**dedup RSSへの初回掲載日時**で通知します。そのため、ページ上では昼の記事が、夜に新着通知されることがあります。

初回取り込みが一巡すると過去記事の通知は減る可能性がありますが、古い記事が後からはてブに現れるケースは今後もあります。**確認すべきなのは「元記事から何時間後か」より、「dedup RSSの公開からSlack投稿まで何分か」です。今回の例では、その部分は正常です。**



----



slackに未通知のまま逃す、というのは、時間が経てば安定する？
翻訳版と元で逃しがないことさえ見ておけば、あとはslack側がちゃんと時差ありでも通知してくれる？



------



**いいえ。時間が経てば、未通知分が必ず追いつく仕組みではありません。**

確認すべきことは2段階あります。

| 確認 | 分かること |
|---|---|
| 元RSSと翻訳RSSの記事URLが一致 | 翻訳・RSS生成に漏れがない |
| 翻訳RSSとSlackの投稿URLが一致 | Slackへの通知にも漏れがない |

Slackは前回取得した記事日時より新しい記事を取得します。**日時判定で対象外になった記事が、待つだけで再通知されるとは限りません。** [Slack公式仕様](https://slack.com/help/articles/218688467-Add-RSS-feeds-to-Slack)

今回の修正は、その日時による取りこぼしを防ぐためのものです。ただし、こちらにはまだ**Slackへの到達確認・未通知分の再送処理がありません**。

したがって、**「元RSSと翻訳RSSがそろっていれば、あとはSlackが全部通知してくれる」とは保証できません。** 通知漏れを放置しないためには、Slackの実投稿まで照合する必要があります。



-----



slackの投稿内容は取れますよね？



-----


はい。**接続済みのSlackから投稿内容・記事URL・投稿時刻を取得できます。** 先ほどの調査でも実投稿を確認しました。

これをRSSの掲載記事と照合すれば、**通知済み／一定時間待っても投稿が見つからない記事**を調べられます。

ただし、**このチャットからSlackを調べること**と、**GHAで定期的に自動照合すること**は別です。GHAで行うには、Slack APIの認証・対象チャンネルへの読み取り権限を設定する必要があります。



----


実RSSと、slackチャンネル投稿を見て、時差が大きい、小さい、RSSはあるのにslack投稿がない、などを分析したい。rss, 投稿日時、チャンネル名、などをカラムにもつCSVを作ると良い？



----



はい。**「RSSの記事 × 配信先チャンネル」を1行にしたCSV**が適しています。特に、元記事日時とRSSの通知日時を分けることが重要です。

| カラム | 内容 |
|---|---|
| RSS名・RSS URL | 配信元 |
| チャンネル名・ID | Slackの配信先 |
| 記事タイトル・記事URL | URLを照合キーにする |
| 元RSS記載日時 | 公開日時または更新日時 |
| RSS通知日時 | 自家製RSSの`pubDate` |
| Slack投稿日時・投稿URL | 見つかった実投稿 |
| 元記事→RSSの時間差 | 取り込みまでの時間差 |
| RSS→Slackの時間差 | 生成から通知までの時間差 |
| 判定 | 通知確認／遅延大／投稿未検出／判定対象外 |
| 調査日時 | いつ時点の結果か |
| 備考 | 購読開始前、日時の種類が不明など |

判定では、次を区別します。

- **投稿未検出**：RSSにはあるが、検索したSlack投稿に見つからない。
- **判定対象外**：購読開始前・検索期間外など。
- **遅延大**：通知はあるが、設定した目安を超えている。

なお、自家製RSSの`pubDate`は生成処理の時刻なので、**RSS→Slackの時間差にはデプロイ待ちも含まれます**。Slackだけの遅延を厳密に測るには、RSSへの公開を最初に確認した時刻も記録するとよいです。

まずは**dedup 6本＋翻訳13本を対象に、9/29の実投稿と照合したCSV**にすると、今回の疑問をまとめて検証できます。



-----





いったん全チャンネル対象でとってみて



----



**RSS配信の全64チャンネル・336本を対象にCSVを作成しました。**

対象は9/29、翌9/30の00:46まで追跡しています。SlackのRSS投稿1,817件を照合しました。

- **[記事別の照合結果：2,943行](my-docs/rss-slack-audit-2026-09-29/rss_slack_comparison.csv)**
- [チャンネル別集計](my-docs/rss-slack-audit-2026-09-29/channel_summary.csv)
- [投稿未検出の要確認候補：98行](my-docs/rss-slack-audit-2026-09-29/needs_review.csv)
- [RSS取得状況：336本](my-docs/rss-slack-audit-2026-09-29/feed_summary.csv)
- [Slackの実投稿一覧](my-docs/rss-slack-audit-2026-09-29/slack_posts.csv)

**98行は未通知確定ではありません。** チャンネル作成前の日時、過去の通知、RSSから消えた記事などは別分類にしています。[調査条件](my-docs/rss-slack-audit-2026-09-29/調査条件.md)も併せて確認してください。



-----



で、どうだった？


-----

**自家製RSSの新しい記事は通知を確認できました。ただし、過去記事の未通知は残っており、「すべて通知漏れなし」とはまだ言えません。**

対象は64チャンネル・336フィード、9/29の投稿と9/30 00:46までの追跡分、計1,817投稿です。

旧日時を引き継いだ記事を除き、自家製RSSの日時とSlack投稿日時を比較すると、以下でした。時差にはデプロイ待ちも含みます。

| 対象 | 通知確認数 | 時差の中央値 | 最小〜最大 |
|---|---:|---:|---:|
| 翻訳RSS | 61件 | 約37分 | 約4〜73分 |
| dedup RSS | 15件 | 約14分 | 約4〜23分 |

- **問題になっていたHacker Newsの9件は、全件通知済み**です。RSS生成が9/29 23:25、Slack投稿が9/30 00:37でした。
- **dedupは、はてブ3件・Zenn9件・Qiita3件の通知を確認し、重複投稿は0件**でした。企業ブログ・Menthas・ITmediaは観測期間に通知がなく、通知性能はまだ評価できません。
- はてブで「元記事から約10時間後に通知された」例は、**dedup生成からSlack投稿までは約4分**でした。元記事の公開からの時間を、そのままSlackの遅延とは判断できません。

**未通知候補は98件**ありました。97件は外部RSS、1件は旧日時を引き継いだAI翻訳記事「How we will do better for Australia」です。購読開始日時や通知当時のRSSを取得できていないため、98件すべてが通知漏れと確定したわけではありません。以前のGitLab記事も含め、過去の未通知が自動的に救済されたとは言えません。

一方、元のタグ別チャンネルでは重複が目立ちました。同一URLの初回以降の投稿は、**Qiita AIで124投稿、Zenn AIで72投稿、ITmediaで21投稿**あり、dedupへ集約する意義はあります。

詳細は [チャンネル別集計](/Users/fuhitonakagawa/my-tech-blog-rss-feed/my-docs/rss-slack-audit-2026-09-29/channel_summary.csv)、[未通知候補98件](/Users/fuhitonakagawa/my-tech-blog-rss-feed/my-docs/rss-slack-audit-2026-09-29/needs_review.csv)、[全照合結果](/Users/fuhitonakagawa/my-tech-blog-rss-feed/my-docs/rss-slack-audit-2026-09-29/rss_slack_comparison.csv) で確認できます。





---


stats feedのslack投稿が以下のように鳴ってます


文字数制限があるの？全部出すのではなく、dedupとかまとまっているものはまとめたほうが良いかな？


日次投稿統計
アプリ  00:45
【日次統計】2026-09-29のカテゴリ別投稿数
元記事公開：2026/9/30 0:00:00（日本時間）
2026年09月29日（日本時間）の新着記事をまとめました。
    カテゴリ別投稿数
JVN：200件JVNDB RSS Feed - New Entry：196件
JVNRSS Feed - Update Entry：4件
企業TechBlog dedup：146件企業TechBlog dedup（生成RSS）：146件
Zenn AI関連タグ：139件Zenn - AI：77件
Zenn - 大規模言語モデル（LLM）：33件
Zenn - Claude Code：25件
Zenn - 生成AI：22件
Zenn - Claude：18件
Zenn - AIエージェント：16件
Zenn - 機械学習：11件
Zenn - Codex：7件
Zenn - Anthropic：6件
Zenn - ChatGPT：4件
Zenn - OpenAI：4件
Zenn - ディープラーニング：2件
Zenn dedup：131件Zenn dedup（生成RSS）：131件
Qiita...

my-tech-blog-rss
日次投稿統計
企業のテックブログの更新をまとめたRSSフィードを配信しています。記事を読んでその企業の技術・カルチャーを知れることや、質の高い技術情報を得られることを目的としています。
my-tech-blog-rssmy-tech-blog-rss


-----



**はい、Slack向けは要約にして、全カテゴリ・フィード別内訳は統計ページに残すのがよいです。**

コード上は全文をRSSに入れているため、今回の「Qiita...」はSlack側で省略された可能性が高いです。ただし、RSSアプリ固有の文字数上限は[公式説明](https://slack.com/help/articles/218688467-Add-RSS-feeds-to-Slack)では確認できず、「何文字まで」とは断定できません。

また、`JVN：200件JVNDB…`とつながるのは、こちらの本文生成で親カテゴリと内訳の間に改行が入らないことが原因です。

通知は次の形をおすすめします。

- **dedupがあるカテゴリはdedupに集約**し、元カテゴリを重ねて列挙しない。
- フィード別内訳を省き、カテゴリ別件数だけ載せる。
- 原文・翻訳は同じ行にまとめる。
- 0件のカテゴリも含む全件・内訳は統計ページで表示する。
- 詳細リンクは、省略されても見えるよう冒頭に置く。

例えば、こんな文面です。

```text
【日次統計】2026-09-29
全カテゴリ・フィード別内訳：［詳細リンク］

重複除外フィード
企業TechBlog：146件
Zenn：131件
Qiita：○件
ITmedia：○件
Menthas：○件
はてブ：○件

その他のカテゴリ
JVN：200件
AI：原文○件／翻訳○件
AWS：原文○件／翻訳○件
…
```

**dedupの件数は各元カテゴリの単純合計ではなく、重複除外後の掲載件数を使います。** また、この統計は元記事の公開日基準なので、「その日にSlackへ通知された件数」とは区別して表記するのが適切です。


----


やっぱり、rss投稿するものは省略せず、多かった順に上から並べるようにします


----




統計RSSは**全カテゴリ・全内訳を省略せず、件数の多い順**で配信します。0件も含みます。

並び順は既にその仕様だったため、カテゴリと内訳がつながる改行だけ修正しました。Slack側での表示省略は残る可能性があります。

404テスト・lint・サイト生成を確認済みです。監査で見つかった依存脆弱性も修正版へ更新し、検出0件です。



----

RSS自体は20時間前に来ていますが、slack投稿が10時間前でした


翻訳版にいたってはまだslack投稿がないです。
これはrss -> slackの通知の時差ですか？


Google Cloud Platform (GCP) - Release notes  [02:22]
September 29, 2026
Gemini Enterprise
Feature
Gemini Enterprise: Gemini 3.8 Flash is the default model for AlphaEvolve
AlphaEvolve experiments can now generate candidate programs with Gemini 3.7
Flash and Gemini 3.8 Flash. Gemini 3.8 Flash is the default model AlphaEvolve
uses when you do not explicitly specify a model, replacing Gemini 3.5 Flash.
To use a different model, specify the one you want in the models field of
generationSettings.
Experiments created before this change keep the model recorded in their...Google Cloud DocumentationGoogle Cloud release notes  |  Google Cloud DocumentationGoogle Cloud Documentation


---


**元RSSの時間差と、翻訳版が届かない原因は別でした。翻訳版には、このリポジトリ側の不具合があります。**

| 確認対象 | 結果 |
|---|---|
| 元RSSに記載された日時 | 9/29 16:00 JST |
| 元RSSのSlack投稿 | [9/30 02:22 JST](https://test-dej2512.slack.com/archives/C0AG9JMPT6J/p1790702567634449) |
| 翻訳データ | 9/29分の翻訳あり |
| 翻訳版の配信用RSS | **9/29分がなく、9/22分だけ残っている** |

元RSSの日時からSlack投稿までは約10時間22分です。ただし、RSS記載日時は実際にRSSへ掲載された時刻とは限らないため、全部がSlackの遅延とは断定できません。

翻訳版の原因は、**記事URLの日付部分を削除していること**です。

```text
元の記事URL：
…/release-notes#September_29_2026
…/release-notes#September_28_2026

リポジトリでの処理後：
…/release-notes
…/release-notes
```

日別の記事がすべて同じURLになり、通知用RSSの生成時に1件へ上書きされています。既知の記事として扱われるため、通知日時も更新されません。

**今回は、待っていれば翻訳版が届く状態ではありません。** 日付を含む記事識別用のURL末尾を保持する修正が必要です。以前の「新しい記事は通知できている」という説明は、この形式のフィードを十分に検証できていませんでした。




----



なおしてください


----

修正しました。GCPリリースノートの日付付きURLを保持し、日別の記事が上書きされないようにしています。

- 実RSSで、**9/29分を含む8日分が通常・翻訳RSSに別記事として出ること**を確認
- 再生成してもGUID・通知日時が変わらないことを確認
- 414テスト・lint・型検査が通過、依存監査は検出0件

まだ未デプロイです。push後の生成では、これまで識別できなかった日別記事が新着としてRSSに載るため、Slackにまとめて通知される可能性があります。


----

ちなみに特定のfeedにエラーがあったとき、それ以降も全て配信されなくなる、みたいな状況になることはない？全体的にコードレビューして、潜在的な問題がないか見てほしい




----




karaage ai newsとyamadashyって、会社のテックブログとzennタグとかもフォローしてる？なにが入ってますか？
また、会社テックブログのなかで、私のmy tech blog jpに入ってないものってなにがありますか？
会社ブログに関してはkaraageとyamadaで個別フォローしている元feedをすべてmy tech blog jpに入れたい