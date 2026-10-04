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



----


https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/tech-book/

の左のカテゴリ一覧の並び順をアプデしたい。
Zennとかqiitaはphysical aiが離れているが、まとめたい
my-docs/CleanShot 2026-10-03 at 14.54.06@2x.png

企業テックブログも、日本のものは
dedup
yamadashy
karaage
など、dedupの集約元になっているものは連番にしたいし、

aws en
aws en translated jp
も並べたい

いまはdedup、日本語訳、で離れてカテゴライズしているけど、
それはいらないかな

あと、
右上のハンバーガーメニューを押すと一覧が出てくるけど、
my-docs/CleanShot 2026-10-03 at 14.56.26@2x.png
文字サイズが大きすぎたり、descありなしとか、どのカテゴリにどのurlがはいっているかとか、見にくいので、もうちょっと見やすくしたい。ハンバーガーアイコンであることも、一覧っぽくないアイコンなので、別のが良いかな。いい感じにパット見で一覧であることがわかるアイコンにしてほしい

---

ローカルで以下の形に整えました。

- 左ナビはdedup・日本語訳による分類を外し、関連カテゴリを連続配置
- Zenn／QiitaのPhysical AIを各AIカテゴリの隣へ
- 企業dedup→国内→yamadashy→karaage、AWS英語→日本語訳を隣接
- 右上は箇条書きアイコン＋「フィード一覧」
- 一覧は文字を小さくし、カテゴリごとの折りたたみで購読RSS・取得元を整理

内部テスト・lint・サイト生成は成功。生成HTMLとCSSも照合しています。実ブラウザーの表示確認は接続不可のため未実施で、公開サイトへの反映はpush後です。

依存監査には、既存の[bracesのHigh指摘（修正版なし）](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)が残っています。


-----


左のサイドバーで、カテゴリは、集約や翻訳はその元をトグル不可能なツリーで表示したい

企業techblog dedup
├国内テックブログ
├yamadashy企業テックブログ
└karaageAI情報

Engineering - translated jp
└ Engineering


Zenn dedup
├ Zenn トレンド

みたいな

ちなみに企業テックブログにはyamadashyつけといて


----


左サイドバーを、折りたたみのない枝線付きツリーにしました。

- dedupの下に集約元カテゴリ
- 日本語訳の下に原文カテゴリ
- 「企業テックブログ」→「yamadashy企業テックブログ」

親・子ともリンクで、全67カテゴリを重複なく表示します。

582テスト・lint・サイト生成は成功。公開反映はpush後です。実ブラウザー表示は未確認で、依存監査の既存 `braces` 指摘は残っています。


----


ツリー表示されない単独Feedが目立たないので、1カテゴリのものもう太字にしたい。ネストされているもののみ細字でいい
my-docs/CleanShot 2026-10-03 at 19.11.46@2x.png



----


単独カテゴリを含む最上位をすべて太字にし、ネストされた子カテゴリだけ通常の太さにしました。選択中の子も細字のまま、背景色と下線で強調します。

582テスト・lintは成功。依存監査の既存 `braces` 指摘は残っています。公開反映はpush後です。


----


テーマカラーって変えられる？
いま黄色っぽい色だけど



----


変えられます。黄色の背景・選択色と、オレンジのボタンをまとめて変更できます。ダークモードも合わせて調整できます。

どの色味が好みですか？

- **青系**：すっきりした印象
- **青緑系**：落ち着いた印象
- **グレー系**：記事を主役にした控えめな配色

好みの色やカラーコードの指定でも大丈夫です。


----


awsカラーだとどうなる？ちょっとプロトを見てみたい
awsマネコンっぽい感じのデザイン


----




濃紺のヘッダー、白いサイドバー、青い操作色で、[AWSマネコンのスタイル](https://aws.amazon.com/blogs/aws/announcing-a-visual-update-to-the-aws-management-console-preview/)に寄せた案です。黄色系との比較と、ライト／ダーク切替ができます。

visualize{"path":"/private/tmp/rss-aws-color-prototype/aws-theme.html"}



----



ローカルで見れる？

サムネ表示とか、slackアイコンとか、githubリンクアイコンとかないけど、そこはちゃんと残してくれる？
あと、コピーボタンとか、マネコンだと丸だよね？


my-docs/image.png
my-docs/image copy.png


----

はい、既存のサムネイル・Slackロゴ・GitHubリンクは残します。プロトにも反映し、コピーボタンは参考画像のような**青枠のピル型**にしました。

[更新版のローカルプレビュー](http://127.0.0.1:59049/)

visualize{"path":"/private/tmp/rss-aws-color-prototype/aws-theme.html"}


----

そうそうそれそれ。これ、デザインがにているけど、公開サイトににたデザインを使うのは問題にはならない？


---


**公開版は、もう少し独自の見た目に調整するのを勧めます。** 確認したところ、単に「AWSロゴを使わなければ大丈夫」とは言えません。

AWSの商標ガイドライン第10項には、配色・書体・図形などを含むAWSサイトの「look and feel」を模倣しない旨が明記されています。[AWS公式ガイドライン](https://aws.amazon.com/trademark-guidelines/)

一方、Cloudscapeの公開コードはApache 2.0で利用できます。ただし、これは公開コードの利用許諾であり、AWSの画面全体やブランド表現を自由に複製できるという意味ではありません。[Cloudscapeのライセンス](https://github.com/cloudscape-design/components/blob/main/LICENSE)

今回なら、次の方針がよいと思います。

- **丸いボタン・カード・ツリー**などの一般的なUIは活かす
- ヘッダーの配色や構成に、このRSSサイト独自の特徴を持たせる
- サイト名・RSSロゴを明確に出し、AWS公式との関係を誤認させない
- サムネイル・Slackアイコン・GitHubリンクは維持する

今のプロトを違法と断定するものではありませんが、非侵害の保証もできません。法的な確証が必要なら、最終デザインを知財に詳しい弁護士へ確認するのが確実です。


-----


じゃあヘッダーの色変えましょう

背景は黄色じゃなくて青系だと？


---

本体へ反映しました。**白いヘッダー＋淡い青背景、青枠の丸いボタン、ライトテーマ固定**です。サムネイル・各アイコン・カテゴリツリーも保持しています。

[本体のローカルプレビュー](http://127.0.0.1:59362/rss/aws-jp/)

577テスト・lint・サイト生成は成功。ブラウザー目視確認は未実施、依存監査の既存 `braces` 指摘は残っています。

CSS・README・テストに未ステージ差分があります。公開反映はpush後です。


---


背景も白にしましょう


---

背景も白に統一しました。青いリンク・丸いボタン・カードの枠線はそのままです。

[ローカルプレビュー](http://127.0.0.1:59362/rss/aws-jp/?v=white)

577テスト・lintは成功。依存監査の既存指摘は変わりません。


----


なんか> とタイトルがずれてない？
my-docs/CleanShot 2026-10-03 at 20.09.31@2x.png




---



ずれていました。矢印をタイトルの中央に揃え、開閉時やタイトルの折り返しにも追従するようにしました。

[ローカルプレビュー](http://127.0.0.1:59362/rss/aws-jp/?v=chevron)を再読み込みし、「フィード一覧」で確認できます。





----



daily statsの投稿が以下になってますが、speakers deckが多すぎです。
マージできるカテゴリはマージしたいです。
また、

元記事公開：2026/10/4 0:00:00（日本時間）

2026年10月03日（日本時間）の新着記事をまとめました。
の2行もいらないです。

トップにはその日の合計投稿数も欲しいです。
そして、件数の多い順ですよね？10/3はdesignが0件になってますが、これより上のカテゴリしか投稿がなかったということ？つまり、awsとか自動運転とかhackers newsとかit mediaとか、ニュース系の記事は投稿がなかったの？そんなことないよね？なんでこうなってるの？


【日次統計】2026-10-03のカテゴリ別投稿数
元記事公開：2026/10/4 0:00:00（日本時間）

2026年10月03日（日本時間）の新着記事をまとめました。

    カテゴリ別投稿数
Qiita dedup：170件（AI 124件 / Cloud 33件 / Security 18件 / 人気記事 7件 / Physical AI 2件）
Zenn dedup：111件（AI 89件 / Security 13件 / Cloud 10件 / トレンド 2件 / Physical AI 0件）
Hacker News：37件（en 37件 / translated-jp 37件）
Speaker Deck：28件
Technology - Speaker Deck：13件
Programming - Speaker Deck：8件
Education - Speaker Deck：3件
Business - Speaker Deck：2件
Research - Speaker Deck：1件
Storyboards - Speaker Deck：1件
Design - Speaker Deck：0件...

----


カテゴリは件数順です。ただし、**Designの0件はSpeaker Deck内の取得元の内訳**で、その後にも他カテゴリが続いています。貼られた投稿は途中までの表示です。

[10/3の公開集計](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/statistics/daily/#2026-10-03)には、AWS 8件、自動運転2件、ITmedia 17件、Hacker News 43件があります。遅延取得により投稿時から件数が増えています。

手元の変更では、次の表示になります。

- Speaker Deckなどはカテゴリ単位の1行。取得元の詳細はWebページへ
- 指定の2行は非表示
- 冒頭に合計投稿数。10/3は**667件**（原文カテゴリの延べ件数。翻訳・dedupは加算対象外）
- 全カテゴリは件数順で保持し、冒頭に全文へのリンク

内部テスト577件・lintは通過。依存監査には既存の`braces`のHigh脆弱性が残っています（修正版未提供）。公開反映はまだです。