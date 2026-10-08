import { createHash } from 'node:crypto';
import { isSlackDate, slackArticleKey } from './model';
import { parseSlackArticle } from './state-store';
import type { SlackArticle, SlackFeedState } from './types';

export const receiptTargets = [
  { channel: 'C0C54D00R7D', feed: 'rss/tech-blog-dedup/feeds/rss.xml' },
  { channel: 'C0C5AFM3MMG', feed: 'rss/zenn-dedup/feeds/rss.xml' },
  { channel: 'C0C4V8MHVCP', feed: 'rss/qiita-dedup/feeds/rss.xml' },
  { channel: 'C0C54DVA83D', feed: 'rss/itmedia-dedup/feeds/rss.xml' },
  { channel: 'C0C54DR47FV', feed: 'rss/menthas-dedup/feeds/rss.xml' },
  { channel: 'C0C5EAHBPN0', feed: 'rss/hatena-dedup/feeds/rss.xml' },
] as const;
interface PendingReceipt {
  channel: string;
  feed: string;
  article: SlackArticle;
}
export interface ReceiptState {
  schemaVersion: 1;
  updatedAt: string;
  pending: Record<string, PendingReceipt>;
  confirmed: Record<string, string>;
}
export interface ReceiptClient {
  history(channel: string, oldest: string): Promise<unknown[]>;
  post(channel: string, article: SlackArticle, clientId: string): Promise<void>;
}
const receiptKey = (channel: string, key: string) => `${channel}:${key}`;
const validReceiptKey = (key: string) =>
  receiptTargets.some(({ channel }) => key.startsWith(`${channel}:`)) && /^C[A-Z0-9]+:[a-f0-9]{64}$/.test(key);

/** 未着は期限で捨てず、確認済みだけを90日後に削除する。 */
export const parseReceiptState = (json: string): ReceiptState => {
  const value = JSON.parse(json);
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !isSlackDate(value.updatedAt) ||
    !value.pending ||
    typeof value.pending !== 'object' ||
    Array.isArray(value.pending) ||
    !value.confirmed ||
    typeof value.confirmed !== 'object' ||
    Array.isArray(value.confirmed)
  )
    throw new Error('Slack確認履歴が不正です');
  const pending: ReceiptState['pending'] = {};
  for (const [key, entry] of Object.entries(value.pending)) {
    const candidate = entry as PendingReceipt;
    if (
      !candidate ||
      !receiptTargets.some((target) => target.channel === candidate.channel && target.feed === candidate.feed)
    )
      throw new Error('Slack確認履歴の配信先が不正です');
    const article = parseSlackArticle(candidate.article);
    if (key !== receiptKey(candidate.channel, article.key) || article.firstSeenAt > value.updatedAt)
      throw new Error('Slack確認履歴の記事が不正です');
    pending[key] = { channel: candidate.channel, feed: candidate.feed, article };
  }
  const confirmed: ReceiptState['confirmed'] = {};
  for (const [key, date] of Object.entries(value.confirmed)) {
    if (!validReceiptKey(key) || !isSlackDate(date) || date > value.updatedAt || pending[key])
      throw new Error('Slack確認済み履歴が不正です');
    confirmed[key] = date;
  }
  return { schemaVersion: 1, updatedAt: value.updatedAt, pending, confirmed };
};

/** 保存失敗した実行の候補も統合し、確認済みの記事を未着へ戻さない。 */
export const mergeReceiptStates = (primary: ReceiptState, backup: ReceiptState): ReceiptState => {
  const confirmed = { ...backup.confirmed, ...primary.confirmed };
  for (const [key, date] of Object.entries(backup.confirmed)) {
    if (!confirmed[key] || confirmed[key] < date) confirmed[key] = date;
  }
  const pending = { ...backup.pending, ...primary.pending };
  for (const key of Object.keys(confirmed)) delete pending[key];
  return {
    schemaVersion: 1,
    updatedAt: primary.updatedAt > backup.updatedAt ? primary.updatedAt : backup.updatedAt,
    pending,
    confirmed,
  };
};

/** 投稿本文・unfurl・block内のURLを照合し、タイトル一致だけで着信済みにしない。 */
const postedKeys = (messages: unknown[]): Set<string> => {
  const text = JSON.stringify(messages).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const keys = new Set<string>();
  for (const match of text.matchAll(/https?:\/\/[^\s<>"|\\]+/g)) {
    try {
      keys.add(slackArticleKey(match[0]));
    } catch {
      /* URL以外の文字列は照合しない。 */
    }
  }
  return keys;
};
const clientMessageId = (key: string): string => {
  const hex = createHash('sha256').update(`rss-receipt:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

/** RSSの初回掲載から90分待ち、実投稿の未着だけを上限付きで再送する。 */
export const monitorSlackReceipts = async (
  state: ReceiptState,
  published: SlackFeedState,
  client: ReceiptClient,
  now = new Date(),
): Promise<{ confirmed: number; resent: number; pending: number }> => {
  if (state.updatedAt > now.toISOString()) throw new Error('Slack確認時計が実行時刻より進んでいます');
  for (const target of receiptTargets) {
    const history = published.feeds[target.feed];
    if (!history) throw new Error(`Slack確認対象の公開履歴がありません: ${target.feed}`);
  }
  state.updatedAt = now.toISOString();
  const cutoff = new Date(now.getTime() - 90 * 86400_000).toISOString();
  state.confirmed = Object.fromEntries(Object.entries(state.confirmed).filter(([, date]) => date >= cutoff));
  for (const target of receiptTargets)
    for (const article of published.feeds[target.feed].items) {
      const key = receiptKey(target.channel, article.key);
      if (!state.confirmed[key]) state.pending[key] ??= { ...target, article };
    }
  let confirmed = 0;
  let resent = 0;
  for (const target of receiptTargets) {
    const entries = Object.entries(state.pending).filter(([, entry]) => entry.channel === target.channel);
    if (!entries.length) continue;
    const earliest = Math.min(...entries.map(([, entry]) => Date.parse(entry.article.firstSeenAt))) - 3600_000;
    const found = postedKeys(await client.history(target.channel, String(Math.floor(earliest / 1000))));
    for (const [key, entry] of entries) {
      if (
        found.has(entry.article.key) ||
        (['https://claude.com', 'https://claude.dev'].includes(new URL(entry.article.url).origin) &&
          /^https:\/\/claude\.com\/blog\/[^/?#]+$/.test(entry.article.guid) &&
          found.has(slackArticleKey(entry.article.guid)))
      ) {
        state.confirmed[key] = now.toISOString();
        delete state.pending[key];
        confirmed++;
      }
    }
    // チャンネルごとに5件まで。大量の未着でも一度に投稿を集中させない。
    let sent = 0;
    for (const [key, entry] of entries) {
      if (!state.pending[key] || now.getTime() - Date.parse(entry.article.firstSeenAt) < 90 * 60_000 || sent >= 5)
        continue;
      await client.post(target.channel, entry.article, clientMessageId(key));
      state.confirmed[key] = now.toISOString();
      delete state.pending[key];
      resent++;
      sent++;
    }
  }
  return { confirmed, resent, pending: Object.keys(state.pending).length };
};

/** 429だけRetry-Afterに従う。投稿の曖昧な通信失敗は次回の履歴照合まで再送しない。 */
export class SlackReceiptClient implements ReceiptClient {
  private readonly deadline = Date.now() + 10 * 60_000;
  constructor(
    private readonly token: string,
    private readonly fetcher = fetch,
    private readonly pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {}
  private async call(method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    for (let retry = 0; retry < 4; retry++) {
      if (Date.now() >= this.deadline) throw new Error('Slack確認の時間予算を超えました');
      const response = await this.fetcher(`https://slack.com/api/${method}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(30000, this.deadline - Date.now())),
      });
      if (response.status === 429) {
        await response.body?.cancel();
        const seconds = Number(response.headers.get('retry-after'));
        const ms = Math.max(1000, (Number.isFinite(seconds) ? seconds : 60) * 1000);
        if (Date.now() + ms >= this.deadline) throw new Error('Slack APIの利用制限で確認を完了できません');
        await this.pause(ms);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Slack API HTTP ${response.status}: ${method}`);
      }
      const result = (await response.json()) as Record<string, unknown>;
      if (!result.ok) throw new Error(`Slack API ${method}: ${String(result.error ?? 'unknown_error')}`);
      return result;
    }
    throw new Error(`Slack APIの利用制限が続いています: ${method}`);
  }
  async history(channel: string, oldest: string): Promise<unknown[]> {
    const messages: unknown[] = [];
    let cursor = '';
    const seen = new Set<string>();
    do {
      const result = await this.call('conversations.history', {
        channel,
        oldest,
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });
      if (!Array.isArray(result.messages)) throw new Error('Slack履歴の応答が不正です');
      messages.push(...result.messages);
      const metadata = result.response_metadata as { next_cursor?: string } | undefined;
      cursor = metadata?.next_cursor ?? '';
      if (cursor && (seen.has(cursor) || messages.length > 200_000))
        throw new Error('Slack履歴のページ取得が完了しません');
      if (result.has_more && !cursor) throw new Error('Slack履歴の続きがありません');
      seen.add(cursor);
    } while (cursor);
    return messages;
  }
  async post(channel: string, article: SlackArticle, clientId: string): Promise<void> {
    const escapeSlackText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const result = await this.call('chat.postMessage', {
      channel,
      client_msg_id: clientId,
      parse: 'none',
      unfurl_links: false,
      unfurl_media: false,
      text: `RSS未着分の再送\n${escapeSlackText(article.title)}\n${escapeSlackText(article.url)}`,
      mrkdwn: false,
    });
    if (typeof result.ts !== 'string' || result.channel !== channel) throw new Error('Slack投稿の確認応答が不正です');
  }
}
