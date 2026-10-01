このリポで設定されている便利ツール系って何？
precommit
typos
secretlint
などなど


----


開発補助・品質チェック系だと、主に以下が設定されています。

| ツール | 用途 | このリポでの実行タイミング |
|---|---|---|
| **pre-commit** | コミット前に検査を自動実行 | ステージ済みファイルに **Biome・Secretlint** を実行 |
| **Biome** | コードの静的検査・整形・import整理 | pre-commit、CI、`npm run lint-biome` |
| **Secretlint** | APIキー・秘密鍵などの混入検出 | pre-commit、CI、`npm run lint-secretlint` |
| **typos** | 英単語のスペルミス検出 | CI |
| **TypeScript（tsc）** | TypeScriptの型チェック。`strict`有効 | CI、`npm run lint-ts` |
| **actionlint** | GitHub Actionsのワークフロー検査 | CI |
| **Vitest** | TypeScriptの内部テスト・外部サイト取得テスト | CI、`npm run test-internal`など |
| **V8 coverage** | テストカバレッジ計測・HTMLレポート | CI、`npm run test-coverage` |
| **Ruff** | Pythonの静的検査・フォーマット検査 | CI、手動 |
| **mypy** | Pythonの型チェック。`strict`有効 | CI、手動 |
| **pytest** | Pythonの翻訳処理のテスト | CI、手動 |
| **npm audit** | 依存パッケージの脆弱性監査 | READMEに手動実行手順あり |
| **Renovate** | 依存更新PRの自動作成 | 月次更新・リリース後14日待機・自動マージ無効の設定 |
| **EditorConfig** | エディター間でインデント・改行などを統一 | 対応エディターで編集時 |

設定の中心は [package.json](/Users/fuhitonakagawa/my-tech-blog-rss-feed/package.json)、[CIワークフロー](/Users/fuhitonakagawa/my-tech-blog-rss-feed/.github/workflows/ci.yml)、[pyproject.toml](/Users/fuhitonakagawa/my-tech-blog-rss-feed/pyproject.toml) です。

**pre-commitで動くのは、現状BiomeとSecretlintの2つだけ**です。typos・型チェック・テストはコミット前フックには含まれていません。[フック設定](/Users/fuhitonakagawa/my-tech-blog-rss-feed/.pre-commit-config.yaml)

手元でよく使うコマンドは次のとおりです。

```bash
# コミット前と同じ検査を全ファイルに実行（自動修正なし）
uv run --frozen --group hooks pre-commit run --all-files

# Biomeによる自動修正＋TypeScript型チェック＋Secretlint
npm run lint

# 内部テスト＋カバレッジ
npm run test-coverage

# 依存関係の脆弱性監査
npm audit --audit-level=moderate
```

`npm run lint`はファイルを書き換えますが、pre-commit側のBiomeは検査のみです。



----



そのほか、あると便利系のファイルはなにがある？
CODEOWNERSとかxx templateとか



----


このリポには、ツール設定以外にも次の補助ファイルがあります。**CODEOWNERS・PRテンプレート・Issueテンプレートはすでにあります。**

| ファイル | 用途・このリポの内容 |
|---|---|
| [`.github/CODEOWNERS`](/Users/fuhitonakagawa/my-tech-blog-rss-feed/.github/CODEOWNERS) | ファイルの担当者を指定。全ファイルを `@fuhitonakagawa` に指定 |
| [`.github/pull_request_template.md`](/Users/fuhitonakagawa/my-tech-blog-rss-feed/.github/pull_request_template.md) | PR本文のひな形。概要と、フィード追加時に必要な情報を案内 |
| [`.github/ISSUE_TEMPLATE/new-feed-request.md`](/Users/fuhitonakagawa/my-tech-blog-rss-feed/.github/ISSUE_TEMPLATE/new-feed-request.md) | フィード追加依頼のひな形。企業名・ブログURL・RSS URLを記入 |
| [`AGENTS.md`](/Users/fuhitonakagawa/my-tech-blog-rss-feed/AGENTS.md) | AIエージェント向けの作業規則・設計上の制約・検証基準 |
| [`README.md`](/Users/fuhitonakagawa/my-tech-blog-rss-feed/README.md) | 導入・実行・設定・運用方法 |
| [`.env.example`](/Users/fuhitonakagawa/my-tech-blog-rss-feed/.env.example) | 環境設定の案内。このリポでは翻訳設定の管理場所と認証情報の扱いを記載 |
| `.node-version`・`.tool-versions`・`.python-version` | 開発環境のNode.js・Pythonバージョンを指定 |
| `.editorconfig` | インデント・文字コード・改行などの編集ルール |
| `.gitignore` | 秘密情報・生成物・キャッシュなどをGit管理から除外 |
| `package-lock.json`・`uv.lock` | 依存関係の解決結果を固定し、環境を再現 |
| `LICENSE.txt`・`LICENSES/`・`THIRD_PARTY_NOTICES.md` | リポジトリ・フォーク元・依存ライブラリ・モデルのライセンス情報 |
| `.github/workflows/` | CI、外部テスト、定期的なフィード生成・公開 |
| `.github/actions/` | Python環境準備やキャッシュ復元など、ワークフロー共通処理 |

さらに、**このリポにはないけれど、同じ系統の定番ファイル**は以下です。

| ファイル | あると便利な場面 |
|---|---|
| `CONTRIBUTING.md` | コントリビューター向けに開発・テスト・PR手順をまとめる |
| `SECURITY.md` | 脆弱性を見つけた人に報告先・報告方法を案内する |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | 不具合報告を入力フォームにして、再現手順や環境情報を揃える |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | 機能要望の目的・期待する挙動を揃える |
| `.github/ISSUE_TEMPLATE/config.yml` | Issue作成画面の問い合わせ先や自由形式Issueの可否を設定する |
| `.gitattributes` | Gitでの改行・バイナリ・差分表示の扱いを統一する |
| `.vscode/extensions.json` | 開発用の推奨拡張機能を共有する |
| `.vscode/settings.json`・`tasks.json` | エディター設定やよく使うコマンドを共有する |
| `.devcontainer/devcontainer.json` | コンテナで開発環境を揃える |
| `CODE_OF_CONDUCT.md` | コミュニティ参加者の行動規範を示す |

このリポでは開発手順がREADMEにかなり集約されているので、`CONTRIBUTING.md`を設けるなら、手順の重複を避けてREADMEの該当箇所へ案内する形が合います。




----


actionlintって設定ファイルがあるの？



----



はい、**actionlintには任意の設定ファイルがあります**。

- `.github/actionlint.yaml`
- `.github/actionlint.yml`

セルフホストランナーのラベル、許可する設定変数（`vars`）、ファイル別のエラー除外などを設定できます。設定ファイルなしでも動きます。[公式ドキュメント](https://github.com/rhysd/actionlint/blob/main/docs/config.md)

**このリポには専用設定ファイルはありません。** [`.github/workflows/ci.yml:62`](/Users/fuhitonakagawa/my-tech-blog-rss-feed/.github/workflows/ci.yml:62) に実行設定があり、Docker版actionlintを `-color` オプション付きで実行しています。

つまり、`ci.yml`は「いつ・どう実行するか」、`actionlint.yaml`は「検査の挙動をどう調整するか」を指定するファイルです。



----



ちなみに今時点でqiitaとzennのdedupは最新状況に追従できてますか？



----


**更新は動いていますが、現時点の新着に完全には追いついていません。特にZennには取得の遅れが見られます。**  
10月1日 **8:51頃（日本時間）**に、登録元RSSと公開済みの全6本のdedup RSSを照合しました。

| 確認項目 | Qiita | Zenn |
|---|---:|---:|
| 最新巡回の取得状況 | 22本すべて正常 | 22本すべて正常 |
| 現在の元RSSにあり、全dedupで未掲載の記事 | **9件** | **11件** |
| 未掲載記事のうち、前回取得より前の公開日時を持つ記事 | 0件 | **9件** |

最新の取得は8:02〜8:04頃、サイト公開は8:10に成功しています。取得済み記事については、dedupへの掲載漏れは診断上0件です。[実行結果](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/actions/runs/36788824931)・[公開診断](https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/health/status.json)

- **Qiita**：未掲載9件はすべて前回取得後の新着で、毎時巡回の次回取得待ちと考えられます。
- **Zenn**：未掲載11件のうち9件は7:00〜8:00頃の公開記事です。通常カテゴリにも入っていないため、**dedup処理より前の取得段階で差が出ています**。ZennのRSS応答にはCDNキャッシュが確認できましたが、前回取得時の応答内容までは復元していないため、原因は断定できません。

したがって、**Qiitaは毎時更新の範囲で追従、Zennは一部遅延あり**という状況です。これは登録元RSSと公開RSSの確認結果で、Slackへの投稿状況は別です。



----



qiitaもzennは時間が経てば解決される系ですか？



----



**Qiitaは次回巡回で解消する見込みが高く、Zennも時間経過で反映される可能性はあります。ただし、確実とはまだ言えません。**

- **Qiita**：未掲載9件はすべて前回取得後の新着なので、通常の更新待ちと考えられます。タグ記事にはAPI補完もあります。
- **Zenn**：RSSのキャッシュ更新後、次回巡回で取得されれば反映されます。ただし、前回取得より前の公開記事も未掲載なので、次回の結果で確認する必要があります。

どちらも、**次の巡回までに元RSSから記事が消れると、待つだけでは回収できない場合があります**。特にZennにはQiitaのようなAPI補完がないため、「時間が経てば必ず解決」とは言えません。



-----



