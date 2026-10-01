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




----
