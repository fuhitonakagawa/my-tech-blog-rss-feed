

以下のブログってフォロー入ってますか？
https://www.wiz.io/blog
https://www.aikido.dev/blog




----


**どちらも未登録です。** リポジトリのフィード定義とSlack登録一覧にありませんでした。

両方とも公式RSSがあり、記事を取得・解析できました。

| ブログ | RSS |
|---|---|
| Wiz Blog | [RSS](https://www.wiz.io/feed/rss.xml) |
| Aikido Security Blog | [RSS](https://www.aikido.dev/blog/rss.xml) |

追加先は`security-en`が適切です。`language: "en"`で登録すれば、日本語翻訳フィードの対象にもなります。



----

追加したいです。
enに追加すれば、translateにも勝手に入る？




-----




はい。**`security-en`に`language: "en"`で登録すれば、翻訳版にも自動で入ります。** 以下の2本を追加しました。

- [Wiz Blog RSS](https://www.wiz.io/feed/rss.xml)
- [Aikido Security Blog RSS](https://www.aikido.dev/blog/rss.xml)

push後の生成から[Security翻訳RSS](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/rss/security-jp/feeds/rss.xml)に含まれます。翻訳版をSlackで購読済みなら、追加登録は不要です。**原文もSlackで通知したい場合は、上記2本の登録が別途必要です。**

両RSSの取得と翻訳対象への包含を確認し、447テスト・lint・依存監査が通っています。







----



テストコードが足りていないところとかない？カバレッジ足りてないところとか、エッジケースとか、レアケースとか、潜在的な問題を検知できるケースを追加拡充したい