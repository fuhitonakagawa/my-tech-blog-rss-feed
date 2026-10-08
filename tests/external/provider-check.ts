import type { TestContext } from 'vitest';
import { logger } from '../../src/feed/logger';
import { FeedHttpError } from '../../src/feed/source-request';

/** 提供元の取得拒否だけを未検証として明示し、解析・生成の不具合は失敗にする。 */
export const providerCheck = async <T>(url: string, context: TestContext, run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof FeedHttpError && error.status === 403) {
      logger.warn('[external-test] 提供元が取得を拒否しています（未検証）', { url, status: error.status });
      context.skip();
    }
    throw error;
  }
};
