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

/** 同じ配信元への開始間隔とRetry-Afterを守り、長い待機を後続巡回へ委ねる。 */
export class SourceRequestQueue {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly nextStart = new Map<string, number>();
  private readonly blockedUntil = new Map<string, number>();

  public async fetchXml(url: string): Promise<string> {
    const origin = new URL(url).origin;
    const prior = this.queues.get(origin) ?? Promise.resolve();
    const { promise: gate, resolve: release } = Promise.withResolvers<void>();
    this.queues.set(origin, gate);
    await prior;
    try {
      if ((this.blockedUntil.get(origin) ?? 0) > Date.now()) throw new FeedHttpError(429);
      const wait = (this.nextStart.get(origin) ?? 0) - Date.now();
      if (wait > 0) await new Promise<void>((resolve) => setTimeout(resolve, wait));
      this.nextStart.set(origin, Date.now() + 500);
      const response = await fetch(url, {
        headers: {
          'user-agent': constants.requestUserAgent,
          accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
        },
        signal: AbortSignal.timeout(constants.externalFetchTimeoutMs),
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
