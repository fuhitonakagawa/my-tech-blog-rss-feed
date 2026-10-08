import constants from '../common/constants';
import { publicNetworkDispatcher } from '../common/url-guard';

export class FeedHttpError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP Error: ${status}`);
  }
  public get retryable(): boolean {
    return this.status >= 500 || this.status === 408;
  }
}

/** 通信の一時失敗だけ再試行し、入力・XML検証の不正や取得拒否は繰り返さない。 */
export const isRetryableSourceError = (error: unknown): boolean => {
  if (error instanceof FeedHttpError) return error.retryable;
  const pending: unknown[] = [error];
  for (let index = 0; index < pending.length && index < 32; index++) {
    const value = pending[index] as { name?: string; code?: string; cause?: unknown; errors?: unknown[] } | null;
    if (!value || typeof value !== 'object') continue;
    if (
      value.name === 'TimeoutError' ||
      value.name === 'AbortError' ||
      [
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'ENETUNREACH',
        'EAI_AGAIN',
        'ENOTFOUND',
        'UND_ERR_CONNECT_TIMEOUT',
        'UND_ERR_HEADERS_TIMEOUT',
        'UND_ERR_BODY_TIMEOUT',
        'UND_ERR_SOCKET',
      ].includes(value.code ?? '')
    )
      return true;
    if (value.cause) pending.push(value.cause);
    if (Array.isArray(value.errors)) pending.push(...value.errors.slice(0, 32));
  }
  return false;
};

/** 同じ配信元への開始間隔とRetry-Afterを守り、長い待機を後続巡回へ委ねる。 */
export class SourceRequestQueue {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly nextStart = new Map<string, number>();
  private readonly blockedUntil = new Map<string, number>();

  public async fetchText(url: string, options: { accept?: string; deadline?: number } = {}): Promise<string> {
    const origin = new URL(url).origin;
    // JVNDB新着RDFは大きく応答も遅いため、この公開フィードだけ本文取得の予算を延長する。
    const requestTimeoutMs =
      url === 'https://jvndb.jvn.jp/ja/rss/jvndb_new.rdf' ? 45_000 : constants.externalFetchTimeoutMs;
    const prior = this.queues.get(origin) ?? Promise.resolve();
    const { promise: gate, resolve: release } = Promise.withResolvers<void>();
    this.queues.set(origin, gate);
    await prior;
    try {
      if ((this.blockedUntil.get(origin) ?? 0) > Date.now()) throw new FeedHttpError(429);
      const wait = (this.nextStart.get(origin) ?? 0) - Date.now();
      if (options.deadline !== undefined && Date.now() + Math.max(wait, 0) >= options.deadline)
        throw new Error('取得予算を超えました');
      if (wait > 0) await new Promise<void>((resolve) => setTimeout(resolve, wait));
      this.nextStart.set(origin, Date.now() + 500);
      const response = await fetch(url, {
        headers: {
          'user-agent': constants.requestUserAgent,
          accept:
            options.accept ?? 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
        },
        signal: AbortSignal.timeout(
          Math.min(requestTimeoutMs, Math.max(1, (options.deadline ?? Number.POSITIVE_INFINITY) - Date.now())),
        ),
        dispatcher: publicNetworkDispatcher,
      });
      if (!response.ok) {
        if (response.status === 429) {
          const value = response.headers.get('retry-after');
          const delay =
            value && /^\d+$/.test(value) ? Number(value) * 1000 : value ? Date.parse(value) - Date.now() : 60_000;
          this.blockedUntil.set(origin, Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : 60_000));
        }
        await response.body?.cancel();
        throw new FeedHttpError(response.status);
      }
      return await response.text();
    } finally {
      release();
      if (this.queues.get(origin) === gate) this.queues.delete(origin);
    }
  }
}
