slackでは、サムネが表示されるときとされない時があり、されないときとは過去に同じものが投稿されているときだと訊いたことがあります。
いま、dedupのfeedでもサムネなしの投稿がありますが、dedupされてないんですか？それとも同じのが投稿されていなくてもサムネ省略されることがある？

my-docs/CleanShot 2026-10-02 at 21.04.11@2x.png


----



**同じ記事が過去に投稿されていなくても、サムネイルが表示されないことはあります。サムネなし＝dedup失敗、ではありません。**

Slack公式では、プレビューが表示されない条件として次を挙げています。

- **同じ会話内で、過去1時間以内に同じリンクが共有された**
- ページにプレビュー用データがない、非公開ページである
- 1メッセージに5件を超えるリンクがある
- プレビューの表示設定が無効になっている

「過去にどこかへ投稿されたら常に省略」という仕様ではありません。[Slack公式の説明](https://slack.com/help/articles/204399343-Share-links-and-set-preview-preferences)

今回、画像の2記事をSlackと公開RSSで照合しました。

| 記事 | 通常チャンネルの投稿 | dedupの投稿 |
|---|---|---|
| AIによるコード生成で同じバグが… | [qiita-ai-feed：9:26、9:42](https://test-dej2512.slack.com/archives/C0BVBLKHUEQ/p1790901759315809) | [10:48に1件](https://test-dej2512.slack.com/archives/C0C4V8MHVCP/p1790905708974199) |
| AWS イベントの検知・取得方式 | [qiita-cloud-feed：10:08](https://test-dej2512.slack.com/archives/C0BUSKUD3QF/p1790903317375339) | [10:48に1件](https://test-dej2512.slack.com/archives/C0C4V8MHVCP/p1790905708997199) |

**公開中のdedup RSS 6本では、同一URLの重複は0件でした。** 対象2記事にはRSS上の画像URLもあります。ただし、Slackが今回プレビューを出さなかった具体的な理由までは確認できません。通常チャンネルへの投稿は別の会話なので、上記の「同じ会話内・1時間」の説明だけでは原因を特定できません。

なお、現在のdedupは**6本のdedup RSS間で同じURLを除外する仕様**です。通常チャンネルとの重複や、QiitaとZennへの同内容・別URLの投稿は対象外です。実際にAWSの記事にはZenn版もあり、それぞれ別記事として配信されています。[dedupの仕様]( /Users/fuhitonakagawa/my-tech-blog-rss-feed/README.md:573)





----


dailyの投稿が以下のようになってます。
IT media6行とか、1行にまとめたい。
企業tech dedupがあればkaraage aiとかyamadashyとかも1行にまとめたい



日次投稿統計  [00:55]
【日次統計】2026-10-01のカテゴリ別投稿数
元記事公開：2026/10/2 0:00:00（日本時間）

2026年10月01日（日本時間）の新着記事をまとめました。

    カテゴリ別投稿数
Qiita dedup：176件（AI 133件 / Cloud 32件 / Security 16件 / 人気記事 8件 / Physical AI 0件）
Zenn dedup：154件（AI 131件 / Cloud 14件 / Security 14件 / トレンド 3件 / Physical AI 2件）
企業TechBlog dedup：75件
企業TechBlog dedup（生成RSS）：75件

ITmedia：74件
ITmedia 総合記事一覧：65件
ITmedia AI＋：13件

ITmedia dedup：74件
ITmedia dedup（生成RSS）：74件

はてブ：65件
はてなブックマーク - 人気エントリー - テクノロジー：65件

企業テックブログ：61件
企業テックブログRSS：61件

karaageAI情報：54件
AI情報RSS：54件

はてブ dedup：39件
はてブ...