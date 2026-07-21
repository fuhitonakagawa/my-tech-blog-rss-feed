---
alwaysApply: true
---

# プロジェクト概要

README.md を読んで理解してください

# ルール

## フィード追加のルール

ユーザーにフィードを追加してと言われたら、以下の手順でフィードを追加してください

1. フィード追加の最低限の情報をユーザーに聞く
  - 企業名・ブログ名
  - RSSフィードURL
  - 追加先のセクション（`src/resources/feed-info-list.ts` の `FEED_SECTION_LIST` にある既存セクションを提示して選んでもらう。該当がなければ新規セクションの ID と表示名を確認する）
2. ブランチ作成
   `git checkout -b chore/new-feed-<企業名の英語>`
3. フィードを追加
   `src/resources/feed-info-list.ts` の `FEED_SECTION_LIST` の対象セクションに `['ラベル', 'フィードURL']` を追加
   （新規セクションの場合は `createFeedSection('<id>', '<表示名>', [...])` を追加。ID は英小文字・数字・ハイフンのみ）
4. コミット
   `git commit -am 'chore(feed): <企業名など> 追加`
5. プッシュ
   `git push origin chore/new-feed-<企業名の英語>`
6. プルリクを作成
   pull_request_template.md を参考にプルリクを作成してください
   ghコマンドがあればそれを使用し、なければユーザーに作成方法を指示してください

すべての手順は都度ユーザーに同意を得て進めてください

## セクション追加のルール

ユーザーにセクションを追加してと言われたら、以下を確認して `FEED_SECTION_LIST` に `createFeedSection` の呼び出しを追加してください

- セクション ID（URLスラッグ。英小文字・数字・ハイフンのみ。`/rss/<id>/` と `/rss/<id>/feeds/` に使われる）
- 表示名（ナビゲーション・見出し・フィードタイトルに使われる）
- 所属させるフィード

セクションページ・フィード（atom/rss/json）・ナビゲーション・sitemap は自動生成されるため、個別の追加作業は不要です
