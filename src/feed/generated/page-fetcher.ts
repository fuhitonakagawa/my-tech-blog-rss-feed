import constants from '../../common/constants';
import { publicNetworkDispatcher } from '../../common/url-guard';
import type { GeneratedFeedDefinition } from './types';

/** 生成元ページのHTMLを取得する関数 */
export type GeneratedFeedPageFetcher = (definition: GeneratedFeedDefinition) => Promise<string>;

/** 公開ページから制限付きでHTMLを取得する */
export const fetchGeneratedFeedPage: GeneratedFeedPageFetcher = async (
  definition: GeneratedFeedDefinition,
): Promise<string> => {
  const response = await fetch(definition.pageUrl, {
    headers: {
      'user-agent': constants.requestUserAgent,
    },
    signal: AbortSignal.timeout(constants.generatedFeedFetchTimeoutMs),
    dispatcher: publicNetworkDispatcher,
  });
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
    throw new Error(`HTMLではないレスポンスです: ${response.headers.get('content-type') ?? 'unknown'}`);
  }

  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > constants.generatedFeedMaxResponseBytes) {
    throw new Error(`HTMLのレスポンスサイズが上限を超えています: ${contentLength}`);
  }

  const html = await response.text();
  const responseBytes = Buffer.byteLength(html, 'utf-8');
  if (responseBytes > constants.generatedFeedMaxResponseBytes) {
    throw new Error(`HTMLのレスポンスサイズが上限を超えています: ${responseBytes}`);
  }

  return html;
};
