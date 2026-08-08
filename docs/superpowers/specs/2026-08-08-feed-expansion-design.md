# RSSフィード拡充仕様

## 目的

国内テックブログ、AI、Roboticsに関するRSSフィードを、それぞれの主題に対応するセクションから配信する。

## セクション

- `ai`: 既存のAIセクション。5件のフィードを追加対象とする。
- `jp-tech-blog`: 既存の国内テックブログセクション。45件のフィードを追加対象とする。
- `robotics`: Roboticsセクション。表示名は`Robotics`、表示順は`270`とし、2件のフィードを登録対象とする。

## AIフィード

- The Stanford AI Lab Blog: `https://ai.stanford.edu/blog/feed.xml`
- Lil’Log: `https://lilianweng.github.io/lil-log/feed.xml`
- Learning and Control: `https://sergeylevine.substack.com/feed`
- TalkRL: The Reinforcement Learning Podcast: `https://feeds.transistor.fm/talkrl`
- Brain Inspired: `https://braininspired.co/feed/podcast`

## 国内テックブログフィード

- Preferred Networks Tech Blog: `https://tech.preferred.jp/ja/feed/`
- ABEJA Tech Blog: `https://tech-blog.abeja.asia/rss`
- Fusic 技術ブログのフィード: `https://zenn.dev/p/fusic/feed`
- 株式会社with の記事: `https://qiita.com/organizations/with_corp/activities.atom`
- ヘッドウォータースのフィード: `https://zenn.dev/p/headwaters/feed`
- IBM の記事: `https://qiita.com/organizations/ibm/activities.atom`
- GMOコネクト株式会社 の記事: `https://qiita.com/organizations/gmo-connect/activities.atom`
- データブリックス・ジャパン株式会社 の記事: `https://qiita.com/organizations/databricks/activities.atom`
- KDDI株式会社 の記事: `https://qiita.com/organizations/kddi/activities.atom`
- Microsoft の記事: `https://qiita.com/organizations/microsoft/activities.atom`
- NTTデータ先端技術 の記事: `https://qiita.com/organizations/intellilink/activities.atom`
- 株式会社日立システムズ の記事: `https://qiita.com/organizations/hitachi-systems/activities.atom`
- GitLab合同会社 の記事: `https://qiita.com/organizations/gitlab-japan/activities.atom`
- Japan AWS Jr. Champions の記事: `https://qiita.com/organizations/aws-jr-champions/activities.atom`
- New Relic 株式会社 の記事: `https://qiita.com/organizations/newrelic/activities.atom`
- フリュー株式会社 の記事: `https://qiita.com/organizations/furyu/activities.atom`
- 株式会社リンクアンドモチベーション の記事: `https://qiita.com/organizations/lmi-inc/activities.atom`
- Kaoエンジニアコミュニティβ の記事: `https://qiita.com/organizations/kao-corporation/activities.atom`
- 日鉄ソリューションズ株式会社 の記事: `https://qiita.com/organizations/nssol/activities.atom`
- 株式会社ZOZO の記事: `https://qiita.com/organizations/zozotech/activities.atom`
- kintone の記事: `https://qiita.com/organizations/kintone/activities.atom`
- 本田技研工業株式会社 (Honda) の記事: `https://qiita.com/organizations/honda-motor/activities.atom`
- 株式会社サイバーエージェント の記事: `https://qiita.com/organizations/cyberagent/activities.atom`
- Goodpatch の記事: `https://qiita.com/organizations/goodpatch/activities.atom`
- 株式会社 ドワンゴ の記事: `https://qiita.com/organizations/dwango/activities.atom`
- フューチャー株式会社 の記事: `https://qiita.com/organizations/future/activities.atom`
- 株式会社SmartHR の記事: `https://qiita.com/organizations/smarthr/activities.atom`
- クラウドエース株式会社さんのフィード: `https://zenn.dev/cloud_ace/feed`
- Google Cloud Japanのフィード: `https://zenn.dev/p/google_cloud_jp/feed`
- PKSHAテックブログ のフィード: `https://zenn.dev/p/pksha/feed`
- Accenture Japan (有志)のフィード: `https://zenn.dev/p/acntechjp/feed`
- MIXI DEVELOPERS Tech Blogのフィード: `https://zenn.dev/p/mixi/feed`
- GMOメディアテックブログのフィード: `https://zenn.dev/p/gmomedia/feed`
- エクサウィザーズ Tech Blogのフィード: `https://zenn.dev/p/exwzd/feed`
- JINSテックブログのフィード: `https://zenn.dev/p/jins/feed`
- 株式会社エムニのフィード: `https://zenn.dev/p/emuni/feed`
- 株式会社エクスプラザのフィード: `https://zenn.dev/p/explaza/feed`
- Omiai Tech Blogのフィード: `https://zenn.dev/p/omiai_techblog/feed`
- コミューン株式会社のフィード: `https://zenn.dev/p/dev_commune/feed`
- 東大松尾・岩澤研究室 | LLM開発 プロジェクト[GENIAC]のフィード: `https://zenn.dev/p/matsuolab/feed`
- pixivのフィード: `https://zenn.dev/p/pixiv/feed`
- Snowflake Japanのフィード: `https://zenn.dev/p/snowflakejp/feed`
- LayerXのフィード: `https://zenn.dev/p/layerx/feed`
- エアークローゼットテックブログのフィード: `https://zenn.dev/p/aircloset/feed`
- ムーザルちゃんねるのフィード: `https://zenn.dev/p/moozaru/feed`

## Roboticsフィード

- The Robot Report: `https://www.therobotreport.com/feed/`
- IEEE Spectrum: `https://spectrum.ieee.org/rss/robotics/fulltext`

## 入出力と挙動

各フィードは`label`と`url`を持つ。セクション一覧、セクションページ、RSS、Atom、JSON Feed、ナビゲーション、sitemapでは、セクション定義から得た情報を使用する。

同一URLは複数のセクションに登録しない。登録済みURLが対象に含まれる場合は、既存定義を維持する。表示名とURLは本仕様の値を使用する。

## 検証

すべてのセクション定義がJSONとして読み込めること、セクションIDとURLに重複がないこと、対象フィードが指定セクションに属することを確認する。

各URLに対するHTTP取得とRSSまたはAtom形式の判定を行う。取得できないURLがある場合は、URLを書き換えずに対象と理由を報告する。プロジェクトのテスト、静的解析、シークレット検査を実行する。
