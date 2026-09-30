
precommitとかbiomeとかって入ってる？


---






**Biomeは入っています。pre-commitは未設定です。**

- **Biome**：`1.9.4`を依存に登録済みで、ローカルにもインストールされています。[設定ファイル](/Users/fuhitonakagawa/my-tech-blog-rss-feed/biome.json)でlint・整形・import整理が有効です。
- **pre-commit**：設定ファイルも有効なGitフックもありません。コミット時の自動チェックは動きません。
- **検査コマンド**：`npm run lint`でBiomeの自動修正、TypeScript型検査、Secretlintを実行します。CIでもチェックされます。

なお、`npm run lint`はファイルを書き換えます。今回は確認だけで、実行していません。





----


入れたほうが良い？



----

**このリポジトリなら、コミット前の自動チェックは入れたほうが良いです。** CIで指摘される整形漏れや秘密情報の混入を、手元で早く見つけられます。

構成は軽くするのがおすすめです。

- **コミット時**：ステージ済みファイルのBiome検査・Secretlint
- **CI**：全体のlint・型検査・テスト・サイト生成

今の`npm run lint`をそのままフックにすると、作業中の未ステージファイルまで自動修正する可能性があります。フックは**検査のみで、勝手に修正・ステージしない**構成が合っています。

なお、Gitのコミット前フックと、Python製の管理ツール`pre-commit`は別物です。必要なのは前者で、管理ツールの選択は既存のNode.js構成に合わせれば十分です。


----


じゃあ入れたい



----


[設定ファイル](/Users/fuhitonakagawa/my-tech-blog-rss-feed/.pre-commit-config.yaml)で、ステージ済みファイルのBiome・Secretlint検査を定義しています。自動修正・自動ステージはありません。

**有効化だけ、ターミナルで次を実行してください。** この環境では`.git/hooks`への書き込みが禁止されています。

```bash
uv run --frozen --group hooks pre-commit install
```

検証は、部分ステージの保持・秘密情報の拒否、内部テスト555件、lint・型検査・依存監査すべて通過しています。テスト中に既存の実験的API警告は出ています。




----

.agents/rules/base.md
.cursor/rules/base.mdc
.github/copilot-instructions.md
とか、fork元からずっと残ってますが、必要ですか？codexしか使用しないため、AGENTS.mdしか使いません。いらないなら消したい
他にも.playwright-mcpとか、いらなそうだけど残ってるものとかあったり、
LICENSES/ があるけどLICENSE.txtとかTHIRD_PARTY_NOTICES.mdとかは入ってないとか、リポ整理できそうなところあります。改善点をまとめてほしい


-----

**Codexだけを使うなら、旧AIルール一式は削除してよいです。** ほかにも整理候補があります。一方、ライセンス文書の現在の配置には役割の違いがあり、全部を`LICENSES/`へ移す必要はありません。

今回は調査のみで、ファイルは変更していません。

**削除をおすすめするもの**

| 対象 | 確認できた内容・理由 |
|---|---|
| `.agents/rules/base.md` | 旧AI向けルール。自動コミット・push、毎回の同意確認など、現在のAGENTS.mdと衝突する指示があります |
| `.cursor/rules/base.mdc` | 上記へのシンボリックリンク。Cursorを使わないなら不要です |
| `.github/copilot-instructions.md` | 同じ旧ルールへのシンボリックリンクです |
| `CLAUDE.md` | 同じ旧ルールへのシンボリックリンクです。合わせて削除するのが適切です |
| `.playwright-mcp/` | 過去の画面スナップショットYAMLが3件。テストの入力ではなく、操作時の記録です。削除と`.gitignore`への追加をおすすめします |
| `README-UPSTREAM-FORMAT.md` | READMEの二重管理になっています。現行と異なる導入手順・公開パス説明・末尾のMIT表記があり、読み手が混乱します |

Codexの標準的な指示探索は`AGENTS.md`などを対象とします。今回の旧ルール群を維持する必要はありません。[公式ドキュメント](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

削除時はREADME内のリンク・構成図も合わせて整理します。なお、今回の`.agents/`にはスキルは入っておらず、旧ルールと`.DS_Store`だけでした。

**整理効果が大きいもの**

| 対象 | 改善案 |
|---|---|
| `my-docs/tmp/` | **91ファイル・約19.55MBがGit管理中**。調査用JSON・CSV・HTMLなどはローカル保存へ分離し、今後はGit管理対象外にする |
| `my-docs/`のスクリーンショット・会話メモ | ディレクトリ全体で124ファイル・約23.17MB。継続利用する仕様と、一時的な記録を分ける。必要な知識だけ正式な文書へ移す |
| `README.md` | 約1,100行。まず全ファイルを列挙した構成図を主要ディレクトリ中心に縮めると、変更時の追従負担が減ります |
| `AGENTS.md` | 約29KB。重要な制約を残し、重複する説明を圧縮する。詳細な調査手順は必要時に参照する文書へ分離する余地があります |
| `.gitignore` | 316行あり、複数の開発環境・フレームワークの雛形が混在。実際の生成物・秘密情報・利用環境に合わせて整理する |

`AGENTS.md`はCodexの既定の読み込み上限32KiBに近いため、増やし続けるより内容を絞る価値があります。[公式の上限説明](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

`my-docs/`はユーザーの記録なので、一括削除より**必要な内容の保管先を決めてからGit管理対象を絞る**のが適切です。なお、作業ツリーから消しても過去のGit履歴の容量は減りません。

**設定に残っている不要な参照**

以下は実ファイルが存在しません。

- `biome.json`の`vite.config.ts`
- `vitest.config.ts`の`.eleventy.js`、`eslint.config.mjs`
- `.typos.toml`の`docs/rss.md`

これらは削除候補です。あわせてBiomeの対象に、実在する`vitest.config.ts`と`vitest.external.config.ts`を含めるか整理するとよいです。

`.github/FUNDING.yml`は現在も`github: yamadashy`です。フォーク元への支援案内を意図して残しているのでなければ削除候補です。`CODEOWNERS`はすでに`@fuhitonakagawa`になっています。

**ライセンス文書は、現在の配置を維持するのがおすすめです。**

| ファイル | 役割 |
|---|---|
| `LICENSE.txt` | このフォーク全体について案内するGPLv3の本文 |
| `THIRD_PARTY_NOTICES.md` | フォーク元・依存ライブラリ・モデル・記事の条件の説明 |
| `LICENSES/MIT-upstream.txt` | フォーク元のMIT本文・著作権表示 |
| `LICENSES/Argos-en-ja-MODEL-NOTICES.md` | 翻訳モデル付属の出典表示 |

重複した文書ではありません。[公開設定](/Users/fuhitonakagawa/my-tech-blog-rss-feed/eleventy.config.ts:20)でも、この構成のままサイトへ同梱しています。見通しをよくするなら、READMEにこの役割表を置く程度で十分です。

また、`.cache/`、`.argos/`、`public/`、`coverage/`、`node_modules/`、`.venv/`は生成物・実行環境で、すでにGit管理外です。リポジトリ整理のために一括削除する対象ではありません。

着手順は、**旧AIルールと画面記録の削除 → 古い設定参照と重複READMEの整理 → 調査データの管理方針整理 → README・AGENTS.mdの圧縮**がよいと思います。

----




じゃあ消しましょう。my-docsは残します
README-UPSTREAM-FORMAT.mdの内容は、既存READMEの末尾にトグルで見れるようにするとかにして、ファイルは消しましょう