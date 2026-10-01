以下はRSS登録されてる？

■ETH Robot Learning Course(Oier Mess)
https://cvg.ethz.ch/lectures/Robot-Learning/
■Robot Learning: A Tutorial
https://huggingface.co/spaces/lerobot/robot-learning-tutorial
■IEEE Video Friday
https://spectrum.ieee.org/tag/video-friday
■ロボット大講堂　机器人大讲堂(中国語)
https://www.leaderobot.com/news/type-list


----


**IEEE Video Fridayは既存RSS経由で取得対象です。他の3件は未登録です。**

| 対象 | 登録状況 |
|---|---|
| ETH Robot Learning Course | ❌ 未登録 |
| Robot Learning: A Tutorial | ❌ 未登録。Hugging Face BlogのRSSは登録済みですが、この教材とは別です |
| IEEE Video Friday | ✅ 登録済みの[IEEE Spectrum Robotics RSS](https://spectrum.ieee.org/rss/robotics/fulltext)に含まれています。実際にVideo Fridayの記事を確認しました |
| ロボット大講堂／机器人大讲堂 | ❌ 未登録 |

IEEE Spectrumは[Roboticsカテゴリ](/Users/fuhitonakagawa/my-tech-blog-rss-feed/src/resources/sections/my-tech-blog-robotics.json:10)に英語RSSとして登録されており、日本語翻訳フィードの対象にもなっています。




----



追加したい。enじゃなくてcnがあるから、それが翻訳可能かも知りたい

----


追加しました。

| 対象 | 登録方法・カテゴリ |
|---|---|
| ETH Robot Learning Course | 公式GitHubの変更履歴Atom → Robotics |
| Robot Learning: A Tutorial | 教材の変更履歴をRSS化 → Robotics |
| 机器人大讲堂 | 記事一覧をRSS化 → **Robotics（中国語）** |

教材2件は現在、直近8日間の更新がないため、新着集約には出ません。

**中国語→日本語の翻訳は可能ですが、現在のコードは英日固定なので、今回は中国語原文のみです。**

- Argos：中→英→日のモデル構成と処理拡張が必要です。[公式説明](https://github.com/argosopentech/argos-translate)
- Amazon Translate：中日翻訳に対応しています。こちらもコードの言語指定の拡張が必要です。[対応言語](https://docs.aws.amazon.com/translate/latest/dg/what-is-languages.html)

push・デプロイ後の中国語カテゴリRSS：
`https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/robotics-zh/feeds/rss.xml`

テスト565件・対象サイトの外部テスト・サイトビルドを確認済みです。



----



argosを使い続けるなら、cn -> en -> jpで対応可能？



---


はい。**Argosに中国語→英語モデルを追加し、既存の英語→日本語モデルと組み合わせれば対応可能です。** 言語コードは `zh → en → ja` です。Argosは中間言語を経由する翻訳に対応しています。[公式説明](https://github.com/argosopentech/argos-translate)

このリポでは、モデル追加に加えて、英日固定の対象判定・入力検証・キャッシュなどを拡張する必要があります。モデルを入れるだけでは動きません。

ローカル実行を継続でき、APIキーは不要です。ただし2段階になるため、処理時間が増え、途中の誤訳が日本語にも引き継がれる可能性があります。実モデルでの動作・品質確認はまだです。



----


機能拡張してください
今後cn記事が追加されても汎用的に使える用にお願いします


----

最新コミット `e8783c6` の確認が完了しました。

- [CI](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/actions/runs/36845825832)：全ジョブ成功。前回の型エラーも解消
- フィード生成・デプロイ・Pages反映：成功
- 中国語→日本語RSS：公開先で10記事を確認
- 取得済み記事から生成RSSへの掲載漏れ：0件

ただし、外部取得テストは9件失敗しています。本番でも5配信元に取得エラーが残っており、「元サイトの記事をすべて取得できている」という意味ではありません。


----


新規追加した記事はちゃんとslack投稿、翻訳されてますか？rssへの投稿と、slack投稿、両方見てみて


---

**RSS生成・翻訳は確認できましたが、新規配信元がすべてSlackに届いている状態ではありません。**

| 配信元 | RSS・翻訳の状態 | Slack投稿 |
|---|---|---|
| ロボット大講堂：中国語 | 原文10件・日本語10件。記事URLは全件一致 | 公開チャンネル検索・Roboticsの履歴とも該当投稿なし |
| ETH Robot Learning Course | Atom取得成功。最新更新は4月12日で、直近8日間の集約・翻訳対象外 | 投稿なし |
| Robot Learning: A Tutorial | 単独RSSに50件。最新更新は2025年10月15日で、カテゴリ集約・翻訳対象外 | 投稿なし |
| IEEE Video Friday | 原文・日本語RSSの両方に掲載 | [原文投稿](https://test-dej2512.slack.com/archives/C0BJSLEA6P8/p1790353117886139)あり。該当記事の翻訳投稿は見つからず |

IEEEの記事は9月26日のもので、翻訳チャンネル作成の9月28日より前の記事です。過去記事がSlackで遡及通知されたことは確認できませんでした。

**中国語版には、別RSSのSlack登録が必要です。** 既存の `robotics-jp` は英語記事の翻訳用で、中国語の記事は含みません。登録一覧にも中国語版はありませんでした。ただし、Slackアプリの現在の購読設定そのものは確認できていません。

登録する日本語RSSはこちらです：

```text
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/robotics-zh-jp/feeds/rss.xml
```

なお、既存の英語→日本語の通知は動いています。ANYboticsの記事は、10月1日18:05:33のRSS掲載日時に対して、[Slack投稿は18:30:37](https://test-dej2512.slack.com/archives/C0C500Y7K3K/p1790847037640369)で、差は約25分でした。

**中国語翻訳の品質には問題があります。** 例えば「近亿元融资」が「約10億ドルの資金調達」になっています。10件とも日本語化されていますが、金額・固有名詞まで正確に翻訳できているとは言えません。