# karaageAI情報：既存カテゴリとURLが一致しない取得元

比較対象は、このリポジトリのcompany-tech-blog・ai-news以外の全カテゴリ。HTTP/HTTPS・末尾スラッシュ・エンコードの表記差を正規化している。

大元の登録数：40本。既存カテゴリとのURL一致：33本。以下のURL未一致：7本。

「URL未登録・内容未照合」は、このURLの直接登録がないことを示す。別URLで同じ内容を取得している可能性があり、そのまま追加必要とは判断できない。全件の疎通検証は対象外。確認済みの同等URL・取得エラーは判定と備考に記載する。

| No. | フィード名 | RSS URL | 判定 | 備考 |
|---:|---|---|---|---|
| 1 | ABEJA | https://tech-blog.abeja.asia/feed | 取得済み相当 | 既存の https://tech-blog.abeja.asia/rss と取得した30記事のURLが一致。追加対象から除外可。 |
| 2 | AI Shift | https://www.ai-shift.co.jp/techblog/feed | 未登録・取得エラー | このURLは404。登録する場合は有効な移転先の調査が必要。 |
| 3 | Google | https://developers-jp.googleblog.com/atom.xml | 取得済み相当 | 既存の https://feeds.feedburner.com/GoogleJapanDeveloperRelationsBlog?format=xml とHTTP/HTTPS差を除き取得した25記事が一致。 |
| 4 | Preferred Networks | https://tech.preferred.jp/ja/blog/llm-plamo/feed/ | 別URL登録あり・取得エラー | このURLは転送後404。既存の https://tech.preferred.jp/ja/feed/ も転送先がHTMLでRSSとして取得不可。 |
| 5 | Zenn（機械学習タグ） | https://zenn.dev/topics/機械学習/feed | 別URL登録あり・要照合 | 既存の https://zenn.dev/topics/machinelearning/feed と同じ表示名。各20記事中18記事が一致し掲載差あり。 |
| 6 | エクサウィザーズ | https://techblog.exawizards.com/feed | 旧URL取得エラー | TLS接続失敗。既存カテゴリに https://zenn.dev/p/exwzd/feed あり。旧ブログとの完全な同一性は未確認。 |
| 7 | エクスプラザ | https://tech.explaza.jp/feed | 旧URL取得エラー | TLS接続失敗。既存カテゴリに https://zenn.dev/p/explaza/feed あり。旧ブログとの完全な同一性は未確認。 |
