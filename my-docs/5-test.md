test系が元リポのurlになってます。
これをGH Pagesでデプロイしたものが
https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/
なので、それを踏まえてアプデして

---


原因が特定できました。lint-biome ジョブの失敗です。

原因と修正

CI の lint-biome は biome check --write && git diff --exit-code（フォーマット済みであることの検証）を実行しますが、push されたコミットに src/resources/feed-info-list.ts のフォーマット未適用箇所（security-advisory セクションの長い行）が含まれていました。

ローカルで biome check --write を適用済みで、lint（Biome / tsc / secretlint）・テスト60件すべて通過を確認しました。修正は working tree にあります：

src/resources/feed-info-list.ts | 10 ++++++++--  （フォーマットのみ）

グローバルルールに従い私はコミットしないので、以下を実行してください：

git commit -am 'style: biome フォーマット適用' && git push

他に落ちうるCIジョブ（参考）

push をトリガーに走る他のワークフローで、以下は落ちる可能性があります：

1. external-test.yml（External Tests）: 全175フィードへ実アクセスして疎通確認するため、リスト内に死んでいる・CIからブロックされるフィードがあると赤になります（サイト生成には影響なし。失敗フィードはスキップされる設計）
2. ci.yml の generate ジョブ / generate-feed.yml: 実クロールを含みますが、個別フィードの失敗は許容されるので通る見込みです

正確にどのジョブが落ちたかは gh が未認証で確認できませんでした。! gh auth login で認証してもらえれば、失敗ログを直接調査できます。まずは上記の push で lint-biome は直るはずです。



---


完了です。lint・テスト60件すべて通過しています。

更新した箇所

┌──────────────────────────────┬──────────────────────────────────────────────────────────────────┐
│           ファイル           │                               変更                               │
├──────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ tests/feed-validator.test.ts │ フィクスチャXMLの <id> 4箇所を                                   │
│                              │ https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/ に       │
├──────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│                              │ repository.url / bugs.url を                                     │
│ package.json                 │ fuhitonakagawa/my-tech-blog-rss-feed に、author を               │
│                              │ fuhitonakagawa に                                                │
├──────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ .github/CODEOWNERS           │ @yamadashy → @fuhitonakagawa                                     │
└──────────────────────────────┴──────────────────────────────────────────────────────────────────┘

意図的に残した yamadashy 参照

- feed-info-list.ts の「企業テックブログRSS」: yamadashy さんの集約フィードを購読対象として登録しているもの（データとして正しい）
- constants.ts の xUserUrl: ヘッダーのXアイコンのリンク先。ご自身のXアカウントに変えるか、アイコンごと消すか指定があれば対応します
- .github/FUNDING.yml: 元作者のスポンサーリンク。リポジトリに Sponsor ボタンとして表示されるので、不要なら削除します

未コミットの変更（前回の biome フォーマット修正 + 今回分）が working tree にあるので、push すれば CI の lint-biome も直ります。


----

Generate feeds は落ちていません

┌─────────────────┬────────────────────────┬─────────────────────────────────────────────────────┐
│      実行       │          状態          │                        補足                         │
├─────────────────┼────────────────────────┼─────────────────────────────────────────────────────┤
│ 最新（docs      │ 🔄                     │ 成功時は5分程度かかります                           │
│ push分）        │ 実行中（約3分半経過）  │                                                     │
├─────────────────┼────────────────────────┼─────────────────────────────────────────────────────┤
│ 1つ前（feat     │ ⚪ cancelled           │ 失敗ではなく、連続pushにより cancel-in-progress:    │
│ push分）        │                        │ true で自動キャンセルされたもの                     │
├─────────────────┼────────────────────────┼─────────────────────────────────────────────────────┤
│ 手動実行分      │ ✅ success             │ サイト生成〜GitHub Pagesデプロイまで成功済み        │
└─────────────────┴────────────────────────┴─────────────────────────────────────────────────────┘

External Tests（全フィード疎通確認）も前回 push 分は success でした。約175フィードすべて疎通OKです。

落ちているのは CI の2ジョブのみ（両方修正済み）

1. Lint Biome: feed-info-list.ts のフォーマット未適用 → ローカルで適用済み
2. Check typos: my-docs/4-section.md の「Upcomming」（O'Reilly の実際の表記）と「HashiCorp」→「Hashi」の誤検出 → .typos.toml に my-docs/ を除外追加（feed-info-list.ts は既に除外されていたため src 側は問題なし）

未コミットの修正一覧

src/resources/feed-info-list.ts   # biome フォーマット
tests/feed-validator.test.ts      # フィクスチャURLをデプロイ先に更新
package.json                      # repository/bugs/author をフォークに更新
.github/CODEOWNERS                # @fuhitonakagawa に更新
.typos.toml                       # my-docs/ を除外

これを push すれば CI は緑になる見込みです。コミットメッセージ例：

git commit -am 'fix: CI失敗の修正とフォークメタデータの更新' && git push