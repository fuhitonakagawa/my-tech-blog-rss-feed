ここまででアップデートされたことや、開発中のコンテキストをもとに、READMEとAGENTS.mdをアプデしたい



今後開発者エージェントが同じ用に機能改修やインストール手順を聞かれたときに答えられるように、これまでの開発時のナレッジコンテキストをAGENTS.mdにまとめておきたい。開発の経緯とかどんな機能を追加したかとかはreadmeに書いてあるので、そういうものではなくて、開発者が知っておくべきtipsとか、このリポの特徴とか、readmeと被らない内容を書くイメージです


コードを見てわかることや、機能的なことはreadmeに書きます。コードを見てもわからないことや、コードを広範に見ないとわからないことをナレッジとしてagents mdに書くイメージです


-----


2つの文書を役割別に整理しました。

- [README.md](/Users/fuhitonakagawa/my-tech-blog-rss-feed/README.md)：機能、導入・実行手順、設定、生成フィード、公開仕様。
- [AGENTS.md](/Users/fuhitonakagawa/my-tech-blog-rss-feed/AGENTS.md)：日時欠落RSS、抽出の落とし穴、キャッシュ、テスト結果の判断、push・公開確認などの開発知識。

リンク、npmコマンド、JSON例、Markdown構造、Secretlintの検証は通っています。



----


旧バージョンのREADMEはfork元リポのREADMEの構造に則って書かれていなかった？それはそれで便利なので、README-XXXみたいな、FORK元と同じフォーマットであることを表す命名で複製して置いておいて？



-----

整理前のREADMEを、内容そのままで [README-UPSTREAM-FORMAT.md](/Users/fuhitonakagawa/my-tech-blog-rss-feed/README-UPSTREAM-FORMAT.md) に複製しました。

現在のREADMEからもリンクを付けています。複製元との全文一致を確認しました。


-----


旧バージョンのREADMEはfork元リポのREADMEの構造に則って書かれてたの？ちがう？


----



**はい、大枠はフォーク元の構成を引き継いでいました。** 今回、[フォーク元のREADME](https://github.com/yamadashy/tech-blog-rss-feed/blob/main/README.md)と直接比較して確認しました。

共通する構成は「サイト追加の方針」「サイトの追加方法」「開発」「ライセンス」です。その間に、このリポジトリ独自の「セクション」「RSS非対応ページ」の説明などが加わっています。

したがって、正確には**「フォーク元の構成をベースに拡張したREADME」**です。先ほどは照合前にその前提で命名してしまいましたが、比較結果としては妥当でした。