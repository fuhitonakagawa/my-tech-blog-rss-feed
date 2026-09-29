# 不足候補RSSの判定保留と除外

company-tech-blog・ai-news以外の既存カテゴリを比較対象とする。URL未一致の候補は重複排除後662本。HTTPエラーや接続失敗は未登録の証明でも、廃止の証明でもない。429は取得制限であり、404として扱わない。

## 同一の取得結果・転送先として除外：8本

| フィード名 | 候補URL | 対応する既存URL |
|---|---|---|
| ABEJA | https://tech-blog.abeja.asia/feed | https://tech-blog.abeja.asia/rss |
| CARTA | https://techblog.cartaholdings.co.jp/feed | https://techblog.cartaholdings.co.jp/rss |
| DeNA | https://engineering.dena.com/blog/index.xml | https://engineer.dena.com/index.xml |
| Google | https://developers-jp.googleblog.com/atom.xml | https://feeds.feedburner.com/GoogleJapanDeveloperRelationsBlog?format=xml |
| はてな | https://developer.hatenastaff.com/feed | https://developer.hatenastaff.com/rss |
| クックパッド | https://techlife.cookpad.com/feed | https://techlife.cookpad.com/rss |
| ミクシィ | https://mixi-developers.mixi.co.jp/feed | https://medium.com/feed/mixi-developers |
| ヘンリー | https://dev.henry.jp/feed | https://dev.henry.jp/rss |

## 404として除外：3本

| フィード名 | 候補URL | 転送後URL |
|---|---|---|
| AI Shift | https://www.ai-shift.co.jp/techblog/feed | https://www.ai-shift.co.jp/techblog/feed |
| Preferred Networks | https://tech.preferred.jp/ja/blog/llm-plamo/feed/ | https://www.preferred.jp:443/ja/blog/tech/llm-plamo/feed |
| コインチェック | https://tech.coincheck.blog/feed | https://tech.coincheck.blog/feed |

## 判定保留：170本

HTTP 429：157本、HTTP 403：2本、接続・TLSエラー：4本、記事リンクなし：5本、RSSとして解析不可：2本。

| フィード名 | RSS URL | 登録元 | 理由 |
|---|---|---|
| TOWN | https://town.biz/tag/engineer/feed | yamadashy版 | HTTP 200・RSSとして解析不可 |
| レンジャーシステムズ | https://www.ranger-systems.co.jp/ranger-blog/archives/category/tech/feed | yamadashy版 | HTTP 200・RSSとして解析不可 |
| BEENOS | https://zenn.dev/beenos/feed | yamadashy版 | HTTP 200・記事リンクなし |
| N-Technologies | https://zenn.dev/n1nc/feed | yamadashy版 | HTTP 200・記事リンクなし |
| Sysdig | https://www.scsk.jp/sp/sysdig/rss.xml | yamadashy版 | HTTP 200・記事リンクなし |
| ベイジ | https://baigie.me/feed/ | yamadashy版 | HTTP 200・記事リンクなし |
| ロジクラ | https://blog.logikura.dev/feed | yamadashy版 | HTTP 200・記事リンクなし |
| BFT名古屋 | https://bftnagoya.hateblo.jp/feed | yamadashy版 | HTTP 403 |
| GMOリサーチ | https://gmor-sys.com/feed/ | yamadashy版 | HTTP 403 |
| ADAWARP | https://zenn.dev/p/adawarp/feed | yamadashy版 | HTTP 429 |
| AEON | https://zenn.dev/p/aeonpeople/feed | yamadashy版 | HTTP 429 |
| ALGO ARTIS | https://zenn.dev/p/algoartis/feed | yamadashy版 | HTTP 429 |
| atama plus | https://zenn.dev/atamaplus_dev/feed | yamadashy版 | HTTP 429 |
| atama plus (Zenn Publication) | https://zenn.dev/p/atamaplus/feed | yamadashy版 | HTTP 429 |
| BALEEN STUDIO | https://zenn.dev/p/baleenstudio/feed | yamadashy版 | HTTP 429 |
| Bitkey | https://zenn.dev/p/bitkey_dev/feed | yamadashy版 | HTTP 429 |
| CyberACE | https://zenn.dev/p/cyberace/feed | yamadashy版 | HTTP 429 |
| DELTA | https://zenn.dev/p/team_delta/feed | yamadashy版 | HTTP 429 |
| e-Agency | https://zenn.dev/p/e_agency/feed | yamadashy版 | HTTP 429 |
| ELEMENTS | https://zenn.dev/p/elements/feed | yamadashy版 | HTTP 429 |
| Fixstars Amplify | https://zenn.dev/p/amplify/feed | yamadashy版 | HTTP 429 |
| Geekplus | https://zenn.dev/p/geekplus/feed | yamadashy版 | HTTP 429 |
| GENDA | https://zenn.dev/p/genda_jp/feed | yamadashy版 | HTTP 429 |
| GENIEE | https://zenn.dev/p/geniee/feed | yamadashy版 | HTTP 429 |
| GVA TECH | https://zenn.dev/p/gvatech_blog/feed | yamadashy版 | HTTP 429 |
| Hacobu | https://zenn.dev/p/hacobu/feed | yamadashy版 | HTTP 429 |
| hokan | https://zenn.dev/p/hokan_blog/feed | yamadashy版 | HTTP 429 |
| INAP Vision | https://zenn.dev/p/inapvision/feed | yamadashy版 | HTTP 429 |
| INTAGE | https://zenn.dev/p/intage_tech/feed | yamadashy版 | HTTP 429 |
| ispec | https://zenn.dev/ispec/feed | yamadashy版 | HTTP 429 |
| jinjer | https://zenn.dev/p/jinjer_techblog/feed | yamadashy版 | HTTP 429 |
| JOPS | https://zenn.dev/p/jops/feed | yamadashy版 | HTTP 429 |
| Linc'well | https://zenn.dev/p/lincwell_inc/feed | yamadashy版 | HTTP 429 |
| mediba | https://zenn.dev/p/mediba/feed | yamadashy版 | HTTP 429 |
| microCMS | https://zenn.dev/p/microcms/feed | yamadashy版 | HTTP 429 |
| mofmof (Zenn) | https://zenn.dev/p/mofmof_inc/feed | yamadashy版 | HTTP 429 |
| moze | https://zenn.dev/p/moze_ai/feed | yamadashy版 | HTTP 429 |
| mutex | https://zenn.dev/p/mutex_inc/feed | yamadashy版 | HTTP 429 |
| Nexta | https://zenn.dev/p/nexta_/feed | yamadashy版 | HTTP 429 |
| no plan | https://zenn.dev/no_plan/feed | yamadashy版 | HTTP 429 |
| NTT DATA TECH | https://zenn.dev/p/nttdata_tech/feed | yamadashy版 | HTTP 429 |
| pipon | https://zenn.dev/p/pipon_tech_blog/feed | yamadashy版 | HTTP 429 |
| RemitAid | https://zenn.dev/p/remitaid/feed | yamadashy版 | HTTP 429 |
| satto | https://zenn.dev/p/satto_workspace/feed | yamadashy版 | HTTP 429 |
| SB OAI Japan | https://zenn.dev/p/sboai_tech/feed | yamadashy版 | HTTP 429 |
| Scalar | https://zenn.dev/p/scalar_sol_blog/feed | yamadashy版 | HTTP 429 |
| SCOグループ | https://zenn.dev/p/scogr_tech/feed | yamadashy版 | HTTP 429 |
| SecureNavi | https://zenn.dev/p/securenavi_tech/feed | yamadashy版 | HTTP 429 |
| Skyfall | https://zenn.dev/p/skyfall/feed | yamadashy版 | HTTP 429 |
| Spectee | https://zenn.dev/p/spectee/feed | yamadashy版 | HTTP 429 |
| SRE Holdings | https://zenn.dev/sre_aip_tech/feed | yamadashy版 | HTTP 429 |
| Sun* | https://zenn.dev/p/sun_asterisk/feed | yamadashy版 | HTTP 429 |
| TOKIUM | https://zenn.dev/p/tokium_dev/feed | yamadashy版 | HTTP 429 |
| truestar | https://zenn.dev/p/truestar/feed | yamadashy版 | HTTP 429 |
| var | https://zenn.dev/var/feed | yamadashy版 | HTTP 429 |
| Virtual Craft | https://zenn.dev/p/virtualcraft/feed | yamadashy版 | HTTP 429 |
| Voicy(Zenn Publication) | https://zenn.dev/p/voicy/feed | yamadashy版 | HTTP 429 |
| Weathernews | https://zenn.dev/p/weathernews/feed | yamadashy版 | HTTP 429 |
| WOGO | https://zenn.dev/p/wogo_techblog/feed | yamadashy版 | HTTP 429 |
| X Mile | https://zenn.dev/p/xmile/feed | yamadashy版 | HTTP 429 |
| younap Tech Blog | https://zenn.dev/p/younap/feed | yamadashy版 | HTTP 429 |
| Zenn | https://zenn.dev/p/team_zenn/feed | yamadashy版 | HTTP 429 |
| Zenn（機械学習タグ） | https://zenn.dev/topics/機械学習/feed | karaageAI情報 | HTTP 429 |
| ZEROUM | https://zenn.dev/zeroum/feed | yamadashy版 | HTTP 429 |
| ZIPAIR | https://zenn.dev/p/zipair_tokyo/feed | yamadashy版 | HTTP 429 |
| ZOZO(Zenn Publication) | https://zenn.dev/p/zozotech/feed | yamadashy版 | HTTP 429 |
| あした | https://zenn.dev/p/ashita_team/feed | yamadashy版 | HTTP 429 |
| おてつたび | https://zenn.dev/otetsutabi_tech/feed | yamadashy版 | HTTP 429 |
| ちゅらデータ | https://zenn.dev/p/churadata/feed | yamadashy版 | HTTP 429 |
| ちょっと | https://zenn.dev/p/chot/feed | yamadashy版 | HTTP 429 |
| みてねコールドクター | https://zenn.dev/p/calldoctor_blog/feed | yamadashy版 | HTTP 429 |
| ゆめみ | https://zenn.dev/p/yumemi_inc/feed | yamadashy版 | HTTP 429 |
| アイレット | https://zenn.dev/p/iret/feed | yamadashy版 | HTTP 429 |
| アクセルマーク | https://zenn.dev/axelmark/feed | yamadashy版 | HTTP 429 |
| アクトビ | https://zenn.dev/p/actbe_tech/feed | yamadashy版 | HTTP 429 |
| アスエネ | https://zenn.dev/p/asuene/feed | yamadashy版 | HTTP 429 |
| アプリボット | https://zenn.dev/p/applibot_tech/feed | yamadashy版 | HTTP 429 |
| アルサーガパートナーズ | https://zenn.dev/p/arsaga/feed | yamadashy版 | HTTP 429 |
| アルダグラム | https://zenn.dev/aldagram/feed | yamadashy版 | HTTP 429 |
| アルダグラム(Zenn Publication) | https://zenn.dev/p/aldagram_tech/feed | yamadashy版 | HTTP 429 |
| アンドドット | https://zenn.dev/p/and_dot/feed | yamadashy版 | HTTP 429 |
| イエソド | https://zenn.dev/p/yesodco/feed | yamadashy版 | HTTP 429 |
| イノベーション | https://zenn.dev/p/innovation/feed | yamadashy版 | HTTP 429 |
| インフォメーション・ディベロプメント | https://zenn.dev/p/idnet/feed | yamadashy版 | HTTP 429 |
| ウェイブ | https://zenn.dev/p/wwwave/feed | yamadashy版 | HTTP 429 |
| ウェルスナビ | https://zenn.dev/p/wn_engineering/feed | yamadashy版 | HTTP 429 |
| エスマット | https://zenn.dev/p/smartshopping/feed | yamadashy版 | HTTP 429 |
| エックスポイントワン | https://zenn.dev/p/x_point_1/feed | yamadashy版 | HTTP 429 |
| エビリー | https://zenn.dev/eviry/feed | yamadashy版 | HTTP 429 |
| エージェントグロー | https://zenn.dev/p/agent_grow/feed | yamadashy版 | HTTP 429 |
| カラビナテクノロジー | https://zenn.dev/p/karabiner_inc/feed | yamadashy版 | HTTP 429 |
| キカガク (Zenn) | https://zenn.dev/p/kikagaku/feed | yamadashy版 | HTTP 429 |
| クロスビット | https://zenn.dev/p/xbit/feed | yamadashy版 | HTTP 429 |
| ケアネット | https://zenn.dev/p/carenet/feed | yamadashy版 | HTTP 429 |
| ゲームエイト | https://zenn.dev/p/game8_blog/feed | yamadashy版 | HTTP 429 |
| ココナラ | https://zenn.dev/coconala/feed | yamadashy版 | HTTP 429 |
| コラボスタイル | https://zenn.dev/p/collabostyle/feed | yamadashy版 | HTTP 429 |
| サイバネットITソリューション | https://zenn.dev/p/cybernet_itsol/feed | yamadashy版 | HTTP 429 |
| サイバーセキュリティクラウド | https://zenn.dev/p/cscloud_blog/feed | yamadashy版 | HTTP 429 |
| サイボウズ Necoチーム | https://zenn.dev/p/cybozu_neco/feed | yamadashy版 | HTTP 429 |
| サイボウズ データチーム | https://zenn.dev/p/cybozu_data/feed | yamadashy版 | HTTP 429 |
| サイボウズ フロントエンド | https://zenn.dev/p/cybozu_frontend/feed | yamadashy版 | HTTP 429 |
| サイボウズ 生産性向上チーム | https://zenn.dev/p/cybozu_ept/feed | yamadashy版 | HTTP 429 |
| シェアフル | https://zenn.dev/sharefull/feed | yamadashy版 | HTTP 429 |
| シビラ | https://zenn.dev/sivira/feed | yamadashy版 | HTTP 429 |
| シンプルフォーム | https://zenn.dev/simpleform/feed | yamadashy版 | HTTP 429 |
| ジェイテックジャパン | https://zenn.dev/jtechjapan/feed | yamadashy版 | HTTP 429 |
| スターフェスティバル | https://zenn.dev/stafes/feed | yamadashy版 | HTTP 429 |
| スターフェスティバル(Zenn Publication) | https://zenn.dev/p/stafes_blog/feed | yamadashy版 | HTTP 429 |
| スピッカート | https://zenn.dev/spicato_inc/feed | yamadashy版 | HTTP 429 |
| スペースマーケット (Zenn) | https://zenn.dev/p/spacemarket/feed | yamadashy版 | HTTP 429 |
| スマートラウンド | https://zenn.dev/smartround/feed | yamadashy版 | HTTP 429 |
| スマートラウンド(Zenn Publication) | https://zenn.dev/p/smartround_dev/feed | yamadashy版 | HTTP 429 |
| ソニックムーブ | https://zenn.dev/p/sonicmoov/feed | yamadashy版 | HTTP 429 |
| ソーシャルPLUS | https://zenn.dev/p/socialplus/feed | yamadashy版 | HTTP 429 |
| タケユー・ウェブ | https://zenn.dev/p/takeyuwebinc/feed | yamadashy版 | HTTP 429 |
| チームラボ　フロントエンド班 | https://zenn.dev/p/teamlab_fe/feed | yamadashy版 | HTTP 429 |
| テラーノベル | https://zenn.dev/p/tellernovel_inc/feed | yamadashy版 | HTTP 429 |
| デザミス | https://zenn.dev/u_motion/feed | yamadashy版 | HTTP 429 |
| トッカシステムズ | https://zenn.dev/p/toccasystems/feed | yamadashy版 | HTTP 429 |
| トドケール | https://zenn.dev/todoker/feed | yamadashy版 | HTTP 429 |
| トドケール(Zenn Publication) | https://zenn.dev/p/todoker_blog/feed | yamadashy版 | HTTP 429 |
| ドクターズプライム | https://zenn.dev/p/drsprime/feed | yamadashy版 | HTTP 429 |
| ドコカデ | https://zenn.dev/dokokade/feed | yamadashy版 | HTTP 429 |
| ドリーム・アーツ テックブログ | https://zenn.dev/p/dreamarts/feed | yamadashy版 | HTTP 429 |
| ナンバーフォー | https://zenn.dev/p/no4_dev/feed | yamadashy版 | HTTP 429 |
| ニコシス | https://zenn.dev/p/nicosys_pub/feed | yamadashy版 | HTTP 429 |
| ハコベル | https://zenn.dev/p/hacobell_dev/feed | yamadashy版 | HTTP 429 |
| パーソンリンク | https://zenn.dev/person_link/feed | yamadashy版 | HTTP 429 |
| ビザスク(Zenn Publication) | https://zenn.dev/p/visasq/feed | yamadashy版 | HTTP 429 |
| ファンタラクティブ | https://zenn.dev/funteractive/feed | yamadashy版 | HTTP 429 |
| ファースト・オートメーション | https://zenn.dev/p/firstautomation/feed | yamadashy版 | HTTP 429 |
| フェズ | https://zenn.dev/p/fez_tech/feed | yamadashy版 | HTTP 429 |
| フォトラクション | https://zenn.dev/p/photoruction_bl/feed | yamadashy版 | HTTP 429 |
| フォルシア | https://zenn.dev/p/forcia_tech/feed | yamadashy版 | HTTP 429 |
| プラハ | https://zenn.dev/p/praha/feed | yamadashy版 | HTTP 429 |
| プラミナス | https://zenn.dev/plminus/feed | yamadashy版 | HTTP 429 |
| プログデンス | https://zenn.dev/p/progdence/feed | yamadashy版 | HTTP 429 |
| ペライチ | https://zenn.dev/peraichi/feed | yamadashy版 | HTTP 429 |
| ペライチ(Zenn Publication) | https://zenn.dev/p/peraichi_blog/feed | yamadashy版 | HTTP 429 |
| ポート | https://zenn.dev/p/port_inc/feed | yamadashy版 | HTTP 429 |
| マイベスト | https://zenn.dev/mybest/feed | yamadashy版 | HTTP 429 |
| マインディア | https://zenn.dev/p/minedia/feed | yamadashy版 | HTTP 429 |
| マップボックス・ジャパン | https://zenn.dev/p/mapbox_japan/feed | yamadashy版 | HTTP 429 |
| マナリンク | https://zenn.dev/manalink/feed | yamadashy版 | HTTP 429 |
| マナリンク(Zenn Publication) | https://zenn.dev/p/manalink_dev/feed | yamadashy版 | HTTP 429 |
| マネーフォワード | https://zenn.dev/p/moneyforward/feed | yamadashy版 | HTTP 429 |
| マルチコンピューティング | https://zenn.dev/p/mcc_techblog/feed | yamadashy版 | HTTP 429 |
| マンハッタンコード | https://zenn.dev/manhattan_code/feed | yamadashy版 | HTTP 429 |
| ミクステンド | https://zenn.dev/p/mixtend/feed | yamadashy版 | HTTP 429 |
| ミスミグループ | https://zenn.dev/p/msmtec/feed | yamadashy版 | HTTP 429 |
| ミラティブ | https://zenn.dev/p/mirrativ_blog/feed | yamadashy版 | HTTP 429 |
| メディアエンジン | https://zenn.dev/media_engine/feed | yamadashy版 | HTTP 429 |
| メンバーズ AIフォーオールカンパニー | https://zenn.dev/p/aiforall/feed | yamadashy版 | HTTP 429 |
| モニクル | https://zenn.dev/p/monicle/feed | yamadashy版 | HTTP 429 |
| モリサワ | https://zenn.dev/p/morisawa/feed | yamadashy版 | HTTP 429 |
| ラブグラフ | https://zenn.dev/p/lovegraph/feed | yamadashy版 | HTTP 429 |
| リバネスナレッジ | https://zenn.dev/p/lnest_knowledge/feed | yamadashy版 | HTTP 429 |
| レスキューナウ | https://zenn.dev/p/rescuenow/feed | yamadashy版 | HTTP 429 |
| レトリバ | https://zenn.dev/p/retrieva_tech/feed | yamadashy版 | HTTP 429 |
| レバテック | https://zenn.dev/p/levtech/feed | yamadashy版 | HTTP 429 |
| レンティオ | https://zenn.dev/rentio/feed | yamadashy版 | HTTP 429 |
| ログラス (Zenn) | https://zenn.dev/p/loglass/feed | yamadashy版 | HTTP 429 |
| 三菱UFJインフォメーションテクノロジー | https://zenn.dev/p/muit_techblog/feed | yamadashy版 | HTTP 429 |
| 損害保険ジャパン DX推進部 | https://zenn.dev/p/sompojapan_dx/feed | yamadashy版 | HTTP 429 |
| 楽天カード | https://zenn.dev/p/rakutencardtech/feed | yamadashy版 | HTTP 429 |
| IIJ | https://eng-blog.iij.ad.jp/feed | yamadashy版 | 接続・TLSエラー |
| SOELU | https://engineering.soelu.com/feed | yamadashy版 | 接続・TLSエラー |
| エクサウィザーズ | https://techblog.exawizards.com/feed | karaageAI情報 | 接続・TLSエラー |
| エクスプラザ | https://tech.explaza.jp/feed | karaageAI情報 | 接続・TLSエラー |

## 比較元で記事を取得できない既存RSS

この表の既存RSSは、記事URL集合による差分比較の範囲外となる。

| カテゴリ | フィード名 | RSS URL | 取得結果 |
|---|---|---|
| ai | Google DeepMind News | https://deepmind.google/blog/rss.xml | not_feed / HTTP 200 |
| db | MongoDB \| Blog | https://www.mongodb.com/blog/rss | 404 / HTTP 404 |
| db | mysql | https://blogs.oracle.com/mysql/rss | http_error / HTTP 403 |
| jp-tech-blog | インフラエンジニアway - Powered by HEARTBEATS | https://heartbeats.jp/hbblog/atom.xml | 404 / HTTP 404 |
| jp-tech-blog | Preferred Networks Tech Blog | https://tech.preferred.jp/ja/feed/ | not_feed / HTTP 200 |
| jp-tech-blog | AI inside Tech Blog | https://note.com/aiinside_tech/rss | empty_feed / HTTP 200 |
