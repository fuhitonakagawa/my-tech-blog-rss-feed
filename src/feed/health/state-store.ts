import { isPublishableHttpUrl } from '../../common/url-guard';
import { removeInvalidUnicode } from '../common-util';
import { isIsoDate } from '../statistics/dates';
import type { CoverageCheck, HealthReport, SourceHealth } from './types';

export const maxHealthHistoryBytes = 16 * 1024 * 1024;
export const maxHealthRuns = 48;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 8192 && removeInvalidUnicode(value) === value;

/** 配信元の診断値を検証し、公開項目だけを引き継ぐ。 */
const parseSource = (source: unknown): SourceHealth => {
  if (
    !record(source) ||
    !text(source.sourceUrl) ||
    !isPublishableHttpUrl(source.sourceUrl) ||
    !text(source.label) ||
    !text(source.sectionId) ||
    !['ok', 'fallback', 'partial', 'error'].includes(String(source.status)) ||
    !(
      source.httpStatus === null ||
      (count(source.httpStatus) && source.httpStatus >= 100 && source.httpStatus <= 599)
    ) ||
    !count(source.received) ||
    !count(source.eligible) ||
    !record(source.excluded) ||
    !['missingDate', 'outsideWindow', 'future', 'invalidIdentifier'].every((key) =>
      count((source.excluded as Record<string, unknown>)[key]),
    ) ||
    !(source.lastSuccessfulAt === null || isIsoDate(source.lastSuccessfulAt)) ||
    !count(source.consecutiveFailures)
  )
    throw new Error('配信元の診断項目が不正です');
  return {
    sourceUrl: source.sourceUrl,
    label: source.label,
    sectionId: source.sectionId,
    status: source.status as SourceHealth['status'],
    httpStatus: source.httpStatus as number | null,
    received: source.received,
    eligible: source.eligible,
    excluded: {
      missingDate: Number(source.excluded.missingDate),
      outsideWindow: Number(source.excluded.outsideWindow),
      future: Number(source.excluded.future),
      invalidIdentifier: Number(source.excluded.invalidIdentifier),
    },
    lastSuccessfulAt: source.lastSuccessfulAt as string | null,
    consecutiveFailures: source.consecutiveFailures,
  };
};

/** 掲載照合の件数と記事キーを検証する。 */
const parseCoverage = (check: unknown): CoverageCheck => {
  if (
    !record(check) ||
    !['normal', 'translated', 'deduplicated'].includes(String(check.kind)) ||
    !text(check.id) ||
    !count(check.expected) ||
    !Array.isArray(check.missing) ||
    !check.missing.every((key) => typeof key === 'string' && /^[a-f0-9]{64}$/.test(key))
  )
    throw new Error('掲載照合の診断項目が不正です');
  return {
    kind: check.kind as CoverageCheck['kind'],
    id: check.id,
    expected: check.expected,
    missing: check.missing,
  };
};

/** 公開済み診断履歴も外部入力として検査し、本文や任意の項目を診断出力へ引き継がない。 */
export const parseHealthHistory = (json: string): HealthReport[] => {
  if (Buffer.byteLength(json) > maxHealthHistoryBytes) throw new Error('診断履歴の上限を超えています');
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data) || data.length > maxHealthRuns) throw new Error('診断履歴が不正です');
  return data.map((value): HealthReport => {
    if (
      !record(value) ||
      value.schemaVersion !== 1 ||
      !isIsoDate(value.checkedAt) ||
      !Array.isArray(value.sources) ||
      !Array.isArray(value.coverage)
    )
      throw new Error('診断項目が不正です');
    const sources = value.sources.map(parseSource);
    const coverage = value.coverage.map(parseCoverage);
    if (new Set(sources.map((source) => source.sourceUrl)).size !== sources.length)
      throw new Error('診断対象が重複しています');
    return { schemaVersion: 1, checkedAt: value.checkedAt, sources, coverage };
  });
};
