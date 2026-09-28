import { fileURLToPath } from 'node:url';
import { statisticsConfig } from '../../feed/statistics/config';
import { readStatisticsState } from '../../feed/statistics/state-store';

/** 公開用の日次統計を閲覧ページへ渡す。 */
export default async function () {
  return readStatisticsState(fileURLToPath(new URL(`../${statisticsConfig.feedPath}`, import.meta.url)));
}
