import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `<script>` にインライン展開するクライアントスクリプト。
 * Nunjucks の `{% include "scripts/index.ts" %}` 相当（ファイル内容をそのまま埋め込む）。
 */
export const indexScript = fs.readFileSync(fileURLToPath(new URL('../scripts/index.ts', import.meta.url)), 'utf-8');

/** 閲覧時点からの記事の相対日時を全ページで表示するスクリプト。 */
export const relativeTimeScript = fs.readFileSync(
  fileURLToPath(new URL('../scripts/relative-time.ts', import.meta.url)),
  'utf-8',
);

/**
 * ヘッダーの登録フィード一覧モーダルを制御するクライアントスクリプト。
 */
export const feedListDialogScript = fs.readFileSync(
  fileURLToPath(new URL('../scripts/feed-list-dialog.ts', import.meta.url)),
  'utf-8',
);

/** 保存されたテーマを初期表示へ適用するスクリプト。 */
export const themeInitScript = fs.readFileSync(
  fileURLToPath(new URL('../scripts/theme-init.ts', import.meta.url)),
  'utf-8',
);

/** ヘッダーのテーマ選択を全ページで利用するスクリプト。 */
export const themeToggleScript = fs.readFileSync(
  fileURLToPath(new URL('../scripts/theme-toggle.ts', import.meta.url)),
  'utf-8',
);
