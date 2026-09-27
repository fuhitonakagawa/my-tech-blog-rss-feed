いったんpushしたので、ghaが回っているか確認したい。その結果生成されたfeed urlについて、品質を確認したい。

生成を待っている間に、以下を対応したい
翻訳カテゴリのタイトルがXXX-JPになっているけど、jpにtranslatedであることがわかるようなsuffixにしたい

翻訳機はいまargosを使用しているけど、将来的にaws bedrock llm apiでの翻訳か、translateによる翻訳を使用する可能性があるため、その辺に対応可能なコードにしておきたい。
翻訳機はコードで指定する形としたい、config.pyみたいなので
envファイルもあるけど、機密でない情報ならenvではなくpyファイルでgit管理できるようにしたい

aws apiはghaからoidcする形式とする。access keyをgha variableに入れるなどは想定しない。ただしいまはoidc providerやawsアカウントがないので、指定がない場合は特に動かない状態で構わない



---

（日本語翻訳）とかじゃなくてtranslated-jpとかtranslate-into-jpみたいな、もっと洗練されたsuffixにして。
あとghaが落ちてます。https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/actions/runs/36344117494
翻訳feedで生成されたrssページはurl教えてください


どこかの適切なドキュメントに、generated/ やtranslateで生成される独自feedのURLの例を書いておきたい


pytorchのリリースノートはen rssでもjp translateでも不要なので、消してしまいたい



-----


PyTorchのリリースノートを削除しました。再生成で、英語・日本語翻訳フィードの両方から除外されることを確認済みです。

あわせて以下を反映しています。

- 表示名を `AI-translated-jp` などに統一。
- [config.py](/Users/fuhitonakagawa/my-tech-blog-rss-feed/scripts/translation/config.py) で翻訳機を選択。AWSはOIDC前提で、未設定なら呼び出しません。
- [README](/Users/fuhitonakagawa/my-tech-blog-rss-feed/README.md:266) に独自生成・翻訳フィードの実URLを記載。
- CI失敗の原因だった `certifi` のスペル誤検知を修正。

公開中のAI翻訳フィード：**[閲覧ページ](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/ai-jp/) / [RSS](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/ai-jp/feeds/rss.xml)**

公開自体は成功しています。ただしArgosには `robotaxis → ロボット軸` などの誤訳があり、技術用語の精度には課題があります。

テスト・静的検査・サイト生成は通過しました。今回の変更は未pushで、AWS実接続は未検証です。



-----


翻訳の精度については一旦このまま様子見ますが、llm apiとかaws translateとかに変えたほうが良いですよね？
ちなみに、argosの翻訳速度とかはどう？問題ない？
キャッシュ使用とかもちゃんとできていそう？
aws版もまだコード動かせていないからテストできないけど、キャッシュ処理などちゃんと入れてある？



------


**今はArgosで様子見で問題ありません。品質を改善する段階では、BedrockのLLMを比較候補にするのがおすすめです。** ただし、AWS版が必ず高品質になるとはまだ断言できません。同じ記事で比較する必要があります。

- **BedrockのLLM**：専門用語・固有名詞の扱いや文体を指示で調整したい場合の候補です。[system指示に対応しています](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html)。
- **Amazon Translate**：翻訳専用サービスとしての候補です。[カスタム用語集](https://docs.aws.amazon.com/translate/latest/dg/how-custom-terminology.html)も使えます。ただし、用語集の指定機能は今回のコードにはまだ含めていません。

**Argosの速度は、現在の件数・更新頻度なら運用できる範囲です。** 実測は次のとおりでした。

| 実行条件 | 翻訳を含む生成・保存・検証時間 |
|---|---:|
| ローカル：357記事、679テキストを新規翻訳 | 約7分38秒 |
| GHA：同規模の新規翻訳 | 約8分30秒 |
| ローカル再実行：347記事、キャッシュあり | **約1.3秒** |

RSS取得・画像取得・サイトビルドは別の時間です。毎回すべてを翻訳する構成ではないため、通常は新着・変更分だけの処理になります。

**キャッシュは実際に効いています。AWS版にも同じ処理が適用されます。**

- タイトル・概要を別々に保存し、同じ原文は重複翻訳しません。
- キャッシュがあれば翻訳機を呼ばないため、AWSでもそのテキストのAPI呼び出しを省けます。
- プロバイダー・モデル・Bedrockの指示や推論設定が変わると、別キャッシュになります。Argosの訳文がAWS版に混ざりません。
- 失敗・空の結果は保存せず、記事は原文で配信します。
- `.cache/translations/` はGHAの保存・復元対象です。Actionsログでもキャッシュの保存・復元を確認しました。

この共通処理は、再利用・概要だけの変更・プロバイダー変更・失敗時の挙動をテストしています。**AWSの実認証・実API・速度・訳文品質は未検証**ですが、キャッシュ処理自体はAWS接続なしで検証できています。

なお、今回はPython依存関係を変更したため、次のpushではArgosのキャッシュ識別子も変わり、初回は再翻訳が発生します。その後は同じ設定・原文の結果を再利用します。




----



新規で生まれた翻訳版rss urlを全部教えてください
リストでください


----



- [AI-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/ai-jp/feeds/rss.xml)
- [AWS-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/aws-jp/feeds/rss.xml)
- [Azure-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/azure-jp/feeds/rss.xml)
- [Google Cloud-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/google-cloud-jp/feeds/rss.xml)
- [Database-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/db-jp/feeds/rss.xml)
- [Engineering-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/engineering-jp/feeds/rss.xml)
- [Platform-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/platform-jp/feeds/rss.xml)
- [Programming-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/programming-jp/feeds/rss.xml)
- [Robotics-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/robotics-jp/feeds/rss.xml)
- [Security Advisory-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/security-advisory-jp/feeds/rss.xml)
- [Security-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/security-jp/feeds/rss.xml)
- [TechCrunch-translated-jp](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/techcrunch-jp/feeds/rss.xml)