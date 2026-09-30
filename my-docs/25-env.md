
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





----

.agents/rules/base.md
.cursor/rules/base.mdc
.github/copilot-instructions.md
とか、fork元からずっと残ってますが、必要ですか？codexしか使用しないため、AGENTS.mdしか使いません。いらないなら消したい
他にも.playwright-mcpとか、いらなそうだけど残ってるものとかあったり、
LICENSES/ があるけどLICENSE.txtとかTHIRD_PARTY_NOTICES.mdとかは入ってないとか、リポ整理できそうなところあります。改善点をまとめてほしい