import type { TestContext } from 'vitest';
import { logger } from '../../src/feed/logger';
import { FeedHttpError, isRetryableSourceError } from '../../src/feed/source-request';

/** 外部取得不能を未検証として記録し、URL・入力・解析・生成の不具合は失敗にする。 */
export const providerCheck = async <T>(url: string, context: TestContext, run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if ((error instanceof FeedHttpError && [403, 429].includes(error.status)) || isRetryableSourceError(error)) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : '外部サイトとの通信に失敗しました';
      Object.assign(context.task.meta, { unverifiedSource: { url, reason } });
      logger.warn('[external-test] 外部サイトから取得できません（未検証）', { url, reason });
      context.skip(reason);
    }
    throw error;
  }
};
