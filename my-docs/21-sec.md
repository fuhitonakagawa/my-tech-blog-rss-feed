

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


google cloud のslack投稿が以下のようになってます。タイトルが全部同じです。これは元RSSがそうなの？


translateのときに、タイトルを対象サービス・プロダクトにするとかしたほうがいい？




googlecloud-feed-translated-jp
8 件のメッセージ
Esc を押して
Google Cloud - Translated Japanese｜企業テックブログRSS
アプリ  13:21
2026年9月29日 | Google Cloud Platform (GCP) - Release notes
元記事公開：2026/9/29 16:00:00（日本時間）
API GatewayFeatureLLM応答やその他のトラフィックのストリーミングの設定 バッファではなく、リクエストとレスポンスをストリームする API Gateway ゲートウェイを作成できるようになりました。 この公開プレビュー機能は、HTTP/2 または HTTP/1.1 チャンクされた転送エンコーディング、サーバー・セント・イベント (SSE)、WebSocket、および gRPC 双

Google Cloud Documentation
Google Cloud release notes  |  Google Cloud Documentation
Google Cloud DocumentationGoogle Cloud Documentation

13:21
2026年9月26日 | Google Cloud Platform (GCP) - Release notes
元記事公開：2026/9/26 16:00:00（日本時間）
Google SecOps SOARAnnouncementRelease 6.3.100 は、すべての地域でご利用いただけます。

Google Cloud Documentation
Google Cloud release notes  |  Google Cloud Documentation
Google Cloud DocumentationGoogle Cloud Documentation

13:21
2026年9月24日 | Google Cloud Platform (GCP) - Release notes
元記事公開：2026/9/24 16:00:00（日本時間）
アクセス承認機能 欠陥の注入のテストは一般に利用できます(GA)。 アクセスの透明性 スタッフ 欠陥の注入のテストは一般に利用できます(GA)。 Apigee ハイブリッドアナウンス v1.15.8 2026年9月24日、Apigee ハイブリッドソフトウェア v1.15.8 のアップデート版をリリースしました。 アップグレードの詳細については、バージョン v1.15.8 に Apigee ハイブ

Google Cloud Documentation
Google Cloud release notes  |  Google Cloud Documentation
Google Cloud DocumentationGoogle Cloud Documentation

13:21
2026年9月27日 | Google Cloud Platform (GCP) - Release notes
元記事公開：2026/9/27 16:00:00（日本時間）
エージェントプラットフォーム WorkbenchChange20260927-2130-rc0 ReleaseChangeInstalled は、上流の依存関係から最新のパッケージをインストールします。 変更M151 ReleaseChangeInstalled は、上流の依存関係から最新のパッケージをインストールします。 FeatureJupyterLabは、クライアント側のログ(コンソールエラ

Google Cloud Documentation
Google Cloud release notes  |  Google Cloud Documentation
Google Cloud DocumentationGoogle Cloud Documentation

13:21
2026年9月22日 | Google Cloud Platform (GCP) - Release notes
元記事公開：2026/9/22 16:00:00（日本時間）
BigQueryの特徴 エージェントレジストリに登録して、デフォルトのGoogle管理認証を使用してインポートすることで、BigQueryのデータエージェントをinGemini Enterpriseに公開できるようになりました。 IfBigQueryとGemini Enterpriseは同じGoogle Cloudプロジェクトにあり、matchAgent Gatewayregionで設定されていま

Google Cloud Documentation
Google Cloud release notes  |  Google Cloud Documentation
Google Cloud DocumentationGoogle Cloud Documentation

13:21
2026年9月23日 | Google Cloud Platform (GCP) - Release notes
元記事公開：2026/9/23 16:00:00（日本時間）
Apigee API ハブ機能 AWS API Gateway および Azure API Management PluginsAPI ハブのプレビュー起動には、サードパーティゲートウェイから API メタデータをインジェストリングするための2つの新しい組み込みプラグインが含まれます。 AWS API ゲートウェイと Azure API 管理。 どちらのプラグインも公開プレビューで、API ハブの

Google Cloud Documentation
Google Cloud release notes  |  Google Cloud Documentation
Google Cloud DocumentationGoogle Cloud Documentation

13:21
2026年9月28日 | Google Cloud Platform (GCP) - Release notes
元記事公開：2026/9/28 16:00:00（日本時間）
エージェントプラットフォーム WorkbenchChange20260927.00_p0 ReleaseChangeInstalled は、上流の依存関係から最新のパッケージをインストールします。 SecurityBulk のセキュリティ パッチは、Workbench のカスタム コンテナ イメージのクリティカルかつ高重度 CVE を修復します。 変更20260927.00_p0 ReleaseC

Google Cloud Documentation
Google Cloud release notes  |  Google Cloud Documentation
Google Cloud DocumentationGoogle Cloud Documentation

13:21
2026年9月25日 | Google Cloud Platform (GCP) - Release notes
元記事公開：2026/9/25 16:00:00（日本時間）
API のキー APIFeature APIについて Keys リモート・モデル・コンテキスト・プロトコル (MCP) サーバーは InPreview で利用できます。 AI アプリケーションから API Keys リモート MCP サーバーに接続して、Google Cloud プロジェクトで API キーのライフサイクルを追跡、検査、制限、管理できます。 詳細については、API キー MCP リ

Google Cloud Documentation
Google Cloud release notes  |  Google Cloud Documentation
Google Cloud DocumentationGoogle Cloud Documentation





------


はい、**元RSSのタイトルが日付だけ**になっています。1記事が「その日の複数サービスの更新まとめ」なので、現在は日付を翻訳したタイトルになります。[Google公式RSS](https://cloud.google.com/feeds/gcp-release-notes.xml)

例えば9月29日の記事には、API Gateway・BigQuery・Cloud Runなど、複数サービスの更新が含まれています。先頭のサービスだけをタイトルにすると、ほかの更新が入っていることが伝わりません。

おすすめは、**日付＋対象サービス名の一覧**です。

- `Google Cloud更新：API Gateway、BigQuery、Cloud Interconnectほか（2026-09-29）`
- `Google Cloud更新：Google SecOps SOAR（2026-09-26）`

本文先頭に対象サービスの全一覧を置けば、Slackで本文が省略されても内容を把握しやすくなります。サービス名は元RSSの見出しから取得できるので、LLMによる推測も不要です。

この方式なら、記事の分割や購読URL・GUIDの変更なしで改善できます。サービスごとに通知を分けたい場合は、別途記事を分割する設計が必要です。

今回のpushは確認できており、[生成Actions](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/actions/runs/36685167917)は現在フィード生成中です。



----


google cloud translated jpのみ、特殊処理をはさむイメージ？それとも1つのen rss urlのみが対象？
bodyをtitleにする、みたいな処理？bodyが2つ並ぶ？


----


提案しているのは、**Google Cloud Release Notesという1本の元RSSに限り、翻訳版の表示を整える処理**です。

- 対象：`https://cloud.google.com/feeds/gcp-release-notes.xml`
- 適用先：Google Cloudの翻訳フィード
- 同じカテゴリのGoogle Cloudブログや、原文フィードはそのまま

**本文を丸ごとタイトルにコピーする処理ではありません。** 本文にあるサービス見出しを抽出して、タイトルを組み立てます。

出力イメージ：

> **Google Cloud更新：API Gateway、BigQuery、Cloud Interconnectほか（2026-09-29）**
>
> 元記事公開：2026/9/29 16:00:00（日本時間）
> 対象サービス：API Gateway、BigQuery、Cloud Interconnect、Cloud Run、…
>
> ［翻訳した本文］

本文は1つです。タイトルと「対象サービス」の行でサービス名は繰り返しますが、本文全体が二重に並ぶことはありません。1日1記事という元RSSの単位と、購読URL・記事IDも維持する想定です。


----

リリースノートって、awsとazureも同じようなrssフォローしてる？


----

はい。ただし、登録先と言語が異なります。

| ベンダー | 登録している更新情報RSS | カテゴリ | 翻訳対象 |
|---|---|---|---|
| Google Cloud | Google Cloud Release Notes | `googlecloud` | ✅ |
| Azure | Azure service updates | `azure` | ✅ |
| AWS | AWS の最新情報（What's New、日本語版） | `aws-ja` | 日本語なので対象外 |

**AWSの英語版What's Newは未登録**です。`aws`カテゴリではAWS News Blogなどの英語ブログ44本を登録し、翻訳しています。

実RSSも確認しました。**AzureとAWSは、更新ごとにサービス名・変更内容を含むタイトルが付いています。** 例えば：

- Azure：`Retirement: Azure Functions v1 hosting model on Azure Container Apps`
- AWS：`Amazon Kinesis Data Streams がデータインジェストを簡素化するサービスマネージドパーティションキーの提供を開始`

そのため、今回の「日付だけのタイトルをサービス名で補う」処理が必要なのは、確認した3本の中ではGoogle Cloud Release Notesです。



----

じゃあそのRSSだけ変えときましょう
元RSSはそのままに、翻訳時に変わるイメージですね



-----


はい、その形で変更しました。**Google Cloud Release Notesの翻訳版だけ**、次の形式になります。

> Google Cloud更新：API Gateway、BigQuery、Cloud Interconnectほか（2026-09-29）

本文先頭に対象サービス一覧を添え、翻訳本文は1回だけ掲載します。元RSS・原文カテゴリ・記事ID・購読URLはそのままです。

実RSSでの確認、456テスト、lint、依存監査が通っています。push後の生成から反映されます。