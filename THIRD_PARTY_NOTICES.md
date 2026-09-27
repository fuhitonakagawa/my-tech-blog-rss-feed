# 第三者ソフトウェア・コンテンツのライセンス

## リポジトリ本体の適用範囲

[LICENSE.txt](LICENSE.txt) はGNU GPLバージョン3の本文です。本フォークの独自部分と組み合わせ全体はGPL-3.0-or-later（バージョン3またはそれ以降）で提供します。

フォーク元由来の部分のMITライセンス本文と著作権表示は [LICENSES/MIT-upstream.txt](LICENSES/MIT-upstream.txt) に保持しています。これらの部分についてMITで許諾される権利も維持されます。第三者ライブラリ、翻訳モデル、取得した記事や画像を、本フォークのGPLで再ライセンスするものではありません。

第三者のソフトウェアには、その配布物に含まれるライセンス・著作権表示・NOTICEが適用されます。本書は翻訳ランタイムの直接依存と主要な間接依存を整理するもので、各ライセンス本文や、配布形態に応じた義務の確認を代替しません。

## 翻訳ランタイムの依存関係

依存関係の固定情報は [Pythonパッケージ定義](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/blob/main/pyproject.toml) と [Pythonロックファイル](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/blob/main/uv.lock) にあります。表のリンクは対象バージョンの配布元です。[ソースコードとビルド定義](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/)も公開しています。

| パッケージ | バージョン | 配布元のライセンス表示 |
| --- | --- | --- |
| [argostranslate](https://pypi.org/project/argostranslate/1.9.6/) | 1.9.6 | MIT |
| [boto3](https://pypi.org/project/boto3/1.43.103/) | 1.43.103 | Apache-2.0 |
| [structlog](https://pypi.org/project/structlog/26.1.0/) | 26.1.0 | MIT OR Apache-2.0 |
| [torch](https://pypi.org/project/torch/2.14.0/) | 2.14.0 | Apache-2.0、Apache-2.0 WITH LLVM-exception、BSD-2-Clause、BSD-3-Clause、BSL-1.0、MITの組み合わせ |
| [ctranslate2](https://pypi.org/project/ctranslate2/4.8.2/) | 4.8.2 | MIT |
| [sentencepiece](https://pypi.org/project/sentencepiece/0.2.2/) | 0.2.2 | Apache-2.0 |
| [stanza](https://pypi.org/project/stanza/1.14.0/) | 1.14.0 | Apache-2.0 |
| [certifi](https://pypi.org/project/certifi/2026.7.22/) | 2026.7.22 | MPL-2.0 |
| [tqdm](https://pypi.org/project/tqdm/4.70.1/) | 4.70.1 | MPL-2.0 AND MIT |
| [udtools](https://pypi.org/project/udtools/0.2.8/) | 0.2.8 | GPL-2.0-or-later |
| [udapi](https://pypi.org/project/udapi/0.5.2/) | 0.5.2 | GPL-3.0-or-later |

`OR`は選択可能なライセンスを示します。`AND`や複数コンポーネントの組み合わせを、MITだけを選べる指定として扱わないでください。PyTorchのLinux CPU版にはバージョンのローカル識別子が付く場合があるため、実際の配布物とロックファイルも参照してください。

表は依存関係全体の再配布用ライセンス集ではありません。JavaScript側の依存関係は [npmロックファイル](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/blob/main/package-lock.json) で固定されています。ライブラリを同梱する配布物では、実際に含まれる直接・間接依存すべてのライセンス表示を保持する必要があります。

## 利用・コード公開・再配布の区別

- **ローカル・CIでの利用**: ライブラリを実行することと、そのライブラリのコピーを第三者へ配布することを区別します。
- **ソースコードの公開**: 本フォークの配布条件はGPL-3.0-or-laterです。フォーク元のMIT表示や各依存の表示も保持します。公開リポジトリであることだけでは、ライセンス表示やソース提供等の条件を満たしたことにはなりません。
- **翻訳ブリッジ**: Pythonプロセス内でArgos・Stanzaをimportする構成です。Node.jsとの通信に標準入出力を使うことだけを根拠に、すべての部分がGPLの適用範囲外と断定しないでください。
- **依存の再配布**: 仮想環境、コンテナ、実行ファイル、モデル、キャッシュ等を第三者に渡す場合は、内容ごとにライセンス文面・著作権表示・対応ソースの提供条件を確認します。リンク一覧を添えるだけで条件を満たすとは限りません。

根拠となる説明は、[GNUの結合・集積に関するFAQ](https://www.gnu.org/licenses/gpl-faq.en.html#MereAggregation)、[GNUのライブラリ結合に関するFAQ](https://www.gnu.org/licenses/gpl-faq.en.html#IfInterpreterIsGPL)、[MozillaのMPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) にあります。特定の結合物の公開条件は、対象コードと配布方法に基づく個別の確認が必要です。

## 翻訳モデル

英日モデルの取得元・バージョン・SHA-256は [固定モデル定義](https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/blob/main/scripts/translation/model.json) に記載されています。Argos本体のMITライセンスを、別配布のモデル重み・同梱データのライセンスとして推定しないでください。

モデルアーカイブのREADMEには、OPUS、Wiktionary由来の辞書、Stanzaの学習済みモデルなどの出典が記載されています。その内容を [モデル付属の出典表示](LICENSES/Argos-en-ja-MODEL-NOTICES.md) に保持しています。

[Argos開発者の説明](https://github.com/argosopentech/argos-translate/issues/76#issuecomment-815704991)では、プロジェクト自身によるモデル学習の成果はコードと同じMITまたはCC0の扱いとされています。この説明は、学習データなど第三者の権利を本リポジトリが再ライセンスできることを意味しません。モデルの配布条件と付属の出典表示は、ソフトウェア本体のGPLとは区別して保持してください。

`.argos/`と`.venv/`はGit管理外で、GitHub Pages向けの`public/`にも含めません。GitHub Actionsのモデルキャッシュは別の保存経路であり、その利用者・アクセス範囲をPagesの公開範囲と同一視しないでください。

## 記事・画像・翻訳結果

元RSSの記事タイトル・概要・画像などの権利は、それぞれの権利者に帰属します。元記事URLや出典の表示は、記事コンテンツの利用許諾を自動的に付与するものではありません。

翻訳ツールのソフトウェアライセンスが、出力されたRSSへ自動的に適用されるとは限りません。一方で、元記事の翻訳・再配信条件は別途適用されます。根拠となる一般的な説明は [GNUの出力に関するFAQ](https://www.gnu.org/licenses/gpl-faq.en.html#WhatCaseIsOutputGPL) にあります。

本書は依存元と適用範囲を整理するための情報です。GPLを含む構成の公開条件やモデルの許諾について、専門家・権利者による個別確認が必要な場合があります。
