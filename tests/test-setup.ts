import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as log4js from 'log4js';
import { afterEach, beforeEach, vi } from 'vitest';
import { logger } from '../src/feed/logger';

logger.level = log4js.levels.WARN;

const acquisitionDirectories = new Map<string, string>();
beforeEach(({ task }) => {
  // 仮想時刻・架空記事の取得記録を本番や別テストへ残さない。
  const acquisitionDirectory = mkdtempSync(path.join(os.tmpdir(), 'rss-test-acquisition-'));
  acquisitionDirectories.set(task.id, acquisitionDirectory);
  vi.stubEnv('FEED_ACQUISITION_DIR', acquisitionDirectory);
  vi.stubEnv('FEED_ACQUISITION_RECOVERY_DIR', undefined);
});
afterEach(({ task }) => {
  const directory = acquisitionDirectories.get(task.id);
  if (directory) rmSync(directory, { recursive: true, force: true });
  acquisitionDirectories.delete(task.id);
  vi.unstubAllEnvs();
});
