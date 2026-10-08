import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  type ReceiptState,
  SlackReceiptClient,
  monitorSlackReceipts,
  parseReceiptState,
} from '../feed/slack/receipt-monitor';
import { readSlackState } from '../feed/slack/state-store';

const directory = '.slack-receipts';
const file = path.join(directory, 'monitor.json');
const token = process.env.SLACK_BOT_TOKEN;
if (!token) throw new Error('SLACK_BOT_TOKENが未設定です。Slack未着確認を実行できません');
let state: ReceiptState;
try {
  state = parseReceiptState(await fs.readFile(file, 'utf8'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  state = { schemaVersion: 1, updatedAt: new Date().toISOString(), pending: {}, confirmed: {} };
}
const published = await readSlackState('.previous-site/feeds/delivery');
if (!published) throw new Error('公開済み通知履歴がありません');
try {
  const result = await monitorSlackReceipts(state, published, new SlackReceiptClient(token));
  console.info('Slack確認結果', result);
  if (result.pending) console.warn(`::warning::Slack投稿の確認待ち: ${result.pending}件。次回も確認します。`);
} finally {
  // API失敗時も未着候補を保持し、RSSの保持期間を過ぎた後も確認する。
  await fs.mkdir(directory, { recursive: true });
  const json = `${JSON.stringify({ ...state, baseCommit: process.env.SLACK_RECEIPTS_BASE_COMMIT || null })}\n`;
  parseReceiptState(json);
  await fs.writeFile(`${file}.tmp`, json);
  await fs.rename(`${file}.tmp`, file);
}
