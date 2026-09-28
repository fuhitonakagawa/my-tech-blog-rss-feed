1日の終りに、その日の合計投稿数をカテゴリごとにまとめて投稿する統計feedをつくりたい。可能？
毎日0:00にGHAが走り始めるイメージです。可能かどうかと、投稿文面イメージください


----

**可能です。1日1件、「前日のカテゴリ別投稿数まとめ」を配信する専用RSSを作れます。** 数値を集計して文面を組み立てるので、LLMや翻訳APIは不要です。

想定する動きは次のとおりです。

- 日本時間0:00に起動し、**前日の0:00〜24:00に公開された記事**を集計する。
- カテゴリ内の同一記事は重複排除する。翻訳版は元記事と同じなので二重計上しない。
- 通常の巡回時に取得記事の履歴を保存し、日次集計に使う。
- 日付ごとに固定IDを付け、再実行でも同じ日の投稿を増殖させない。

**履歴の保存がポイントです。** 深夜にRSSを1回取得するだけでは、その日の途中で配信元RSSから消えた記事を数えられません。統計は「このリポジトリで取得できた記事数」として扱うのが適切です。

既存GHAにも日本時間0:00の実行枠があります。ただしGHAは混雑による遅延や実行の省略があり得るため、**0:00ちょうどの開始・公開は保証されません**。未生成の日を次回の実行で補完できる設計がおすすめです。[GitHub公式説明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

文面は、例えば以下です。**数字は仮です。**

```text
タイトル：
【日次統計】2026-09-28のカテゴリ別投稿数

本文：
2026年9月28日（日本時間）の新着記事をまとめました。

カテゴリ別投稿数
・AI：32件
・Engineering：25件
・Programming：25件
・AWS：18件
・Google Cloud：11件
・Security：9件
・Hacker News：8件

※ このサイトで取得できた記事を集計しています。
※ 翻訳版の重複と、同じカテゴリ内の重複記事は除いています。
※ 投稿が0件のカテゴリは省略しています。
```

前日比も保存した履歴から計算できるので、必要なら `AI：32件（前日比 +8件）` という表示にもできます。

配信URL案は `/feeds/statistics/daily/rss.xml` です。通常RSS・HTML由来の生成RSS・翻訳RSSとは別の統計用フィードとして扱います。

-----


okです、実装して下さい


src/resources/stats/
みたいなjsonを作る感じ？



----


はい。src/resources/stats/daily.json を定義ファイルにする形に揃えます。表示名・集計タイムゾーン・保持日数をJSONで管理し、記事の取得履歴や日次集計の結果は生成データとして別に保存します。通常のsections/や翻訳用のtranslated-feeds/には混ぜません。



実装しました。定義は [src/resources/stats/daily.json](/Users/fuhitonakagawa/my-tech-blog-rss-feed/src/resources/stats/daily.json) です。

- 日本時間0:00に前日分を集計
- 履歴は標準90日保持
- 重複排除・未生成日の補完・遅延取得に対応
- 再実行でも同じ日付の記事は増殖しない
- ナビゲーションと購読一覧にも掲載

push後の配信先：

- [日次統計RSS](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/statistics/daily/rss.xml)
- [閲覧ページ](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/statistics/daily/)

**初回デプロイ日は収集のみで、翌日以降の実行から統計記事を配信します。**

テスト301件、lint、依存監査、サイト生成が通過しました。隔離環境で翌日への切替と再実行も確認済みです。コミット・pushはしていません。