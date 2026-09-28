import Eleventy from '@11ty/eleventy';
import { logger } from '../feed/logger';

/** サイト出力を完了して終了し、ビルド失敗は終了コードで通知する。 */
(async () => {
  const eleventy = new Eleventy(undefined, undefined, {
    configPath: 'eleventy.config.ts',
    source: 'cli',
  });

  await eleventy.write();
})().then(
  () => {
    process.exit(0);
  },
  (error) => {
    logger.error('[site-build] failed', error);
    process.exit(1);
  },
);
