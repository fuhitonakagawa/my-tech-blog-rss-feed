import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { FeedInfo } from '../../resources/feed-info-list';
import type { CustomRssParserItem } from '../feed-crawler';
import { feedItemIdentifier, isDeliverableIdentifier } from '../feed-item-policy';
import { logger } from '../logger';
import { maxHealthHistoryBytes, maxHealthRuns, parseHealthHistory } from './state-store';
import type { CoverageCheck, HealthReport, SourceFetchObservation, SourceHealth } from './types';

/** 取得結果の除外理由を互いに重ならない件数として記録する。 */
const sourceCounts = (
  items: readonly CustomRssParserItem[],
  cutoff: Date,
  now: Date,
): Pick<SourceHealth, 'received' | 'eligible' | 'excluded'> => {
  const excluded = { missingDate: 0, outsideWindow: 0, future: 0, invalidIdentifier: 0 };
  let eligible = 0;
  for (const item of items) {
    const date = Date.parse(item.isoDate);
    if (!Number.isFinite(date)) excluded.missingDate++;
    else if (date < cutoff.getTime()) excluded.outsideWindow++;
    else if (date > now.getTime()) excluded.future++;
    else if (!isDeliverableIdentifier(feedItemIdentifier(item.link, item.guid))) excluded.invalidIdentifier++;
    else eligible++;
  }
  return { received: items.length, eligible, excluded };
};

/** 記事本文を保存せず、配信元の状態・除外件数・最終正常時刻を記録する。 */
export const buildHealthReport = (
  definitions: readonly FeedInfo[],
  observations: readonly SourceFetchObservation[],
  items: readonly CustomRssParserItem[],
  coverage: CoverageCheck[],
  previous: HealthReport | undefined,
  cutoff: Date,
  now: Date,
): HealthReport => {
  const oldSources = new Map(previous?.sources.map((source) => [source.sourceUrl, source]));
  const fetched = new Map(observations.map((source) => [source.sourceUrl, source]));
  return {
    schemaVersion: 1,
    checkedAt: now.toISOString(),
    coverage,
    sources: definitions.map((definition) => {
      const result = fetched.get(definition.url) ?? {
        sourceUrl: definition.url,
        status: 'error' as const,
        httpStatus: null,
      };
      const old = oldSources.get(definition.url);
      return {
        ...result,
        label: definition.label,
        sectionId: definition.sectionId,
        ...sourceCounts(
          items.filter((item) => item.sourceFeedUrl === definition.url),
          cutoff,
          now,
        ),
        lastSuccessfulAt: result.status === 'ok' ? now.toISOString() : (old?.lastSuccessfulAt ?? null),
        consecutiveFailures: result.status === 'ok' ? 0 : (old?.consecutiveFailures ?? 0) + 1,
      };
    }),
  };
};

/** 公開済み直近48実行の診断を保持し、配信停止なしで異常をActionsにも示す。 */
export const writeFeedHealth = async (
  publishedDirectory: string,
  outputDirectory: string,
  createReport: (previous: HealthReport | undefined) => HealthReport,
): Promise<HealthReport> => {
  let history: HealthReport[] = [];
  try {
    const file = path.join(publishedDirectory, 'feeds/health/history.json');
    if ((await fs.stat(file)).size > maxHealthHistoryBytes) throw new Error('診断履歴の上限を超えています');
    history = parseHealthHistory(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') logger.warn('[feed-health] invalid-history');
  }
  const report = createReport(history.at(-1));
  const json = JSON.stringify([...history, report].slice(-maxHealthRuns));
  parseHealthHistory(json);
  const directory = path.join(outputDirectory, 'feeds/health');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'history.json'), `${json}\n`);
  await fs.writeFile(path.join(directory, 'status.json'), `${JSON.stringify(report)}\n`);
  const failures = report.sources.filter((source) => source.status !== 'ok');
  const missing = report.coverage.reduce((total, check) => total + check.missing.length, 0);
  logger.info('[feed-health] summary', { sources: report.sources.length, failures: failures.length, missing });
  if (failures.length || missing) {
    logger.warn('[feed-health] attention-required', { failures: failures.length, missing });
    if (process.env.GITHUB_ACTIONS === 'true')
      console.log(
        `::warning title=Feed health::${failures.length} sources require attention; ${missing} publication checks missing. See feeds/health/status.json.`,
      );
  }
  if (process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `\n### Feed health\n\nSources: ${report.sources.length}; errors/fallbacks: ${failures.length}; missing publication checks: ${missing}.\n\nDetails: feeds/health/status.json\n`,
    );
  return report;
};
