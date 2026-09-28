import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { removeInvalidUnicode } from '../common-util';
import { statisticsConfig } from './config';
import { dayStart, isDay, isIsoDate, jstDay, shiftDay } from './dates';
import { observationKey } from './observations';
import type { ArticleObservation, CategoryCount, DailyReport, StatisticsState } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(value);
const isTitle = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= 200 && removeInvalidUnicode(value) === value;

const isObservation = (value: unknown, schemaVersion: number): value is ArticleObservation =>
  isRecord(value) &&
  typeof value.articleId === 'string' &&
  /^[a-f0-9]{64}$/.test(value.articleId) &&
  (schemaVersion === 1 ||
    value.sourceId === null ||
    (typeof value.sourceId === 'string' && /^[a-f0-9]{64}$/.test(value.sourceId))) &&
  isId(value.sectionId) &&
  isTitle(value.sectionTitle) &&
  isIsoDate(value.publishedAt);

const isCount = (value: unknown): value is CategoryCount =>
  isRecord(value) &&
  isId(value.sectionId) &&
  isTitle(value.title) &&
  Number.isSafeInteger(value.count) &&
  typeof value.count === 'number' &&
  value.count >= 0;

const isReport = (value: unknown): value is DailyReport =>
  isRecord(value) &&
  isDay(value.date) &&
  isIsoDate(value.publishedAt) &&
  isIsoDate(value.updatedAt) &&
  value.publishedAt === dayStart(shiftDay(value.date, 1)) &&
  value.updatedAt >= value.publishedAt &&
  ['observed', 'partial', 'unobserved'].includes(String(value.coverage)) &&
  Array.isArray(value.categories) &&
  value.categories.every(isCount) &&
  new Set(value.categories.map((category) => category.sectionId)).size === value.categories.length;

/** 公開済み統計を外部入力として検証し、重複や不正な日時を拒否する。 */
export const parseStatisticsState = (json: string): StatisticsState => {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('日次統計のJSON形式が不正です');
  }
  if (
    !isRecord(value) ||
    (value.schemaVersion !== 1 && value.schemaVersion !== 2) ||
    !isIsoDate(value.startedAt) ||
    !isIsoDate(value.lastCollectedAt) ||
    value.startedAt > value.lastCollectedAt ||
    !Array.isArray(value.collectionDays) ||
    !value.collectionDays.every(isDay) ||
    !Array.isArray(value.observations) ||
    !value.observations.every((item) => isObservation(item, value.schemaVersion as number)) ||
    !Array.isArray(value.reports) ||
    !value.reports.every(isReport)
  ) {
    throw new Error('日次統計の保存履歴が不正です');
  }
  const state = {
    ...value,
    schemaVersion: 2,
    observations: (value.observations as ArticleObservation[]).map((item) => ({
      ...item,
      sourceId: value.schemaVersion === 1 ? null : item.sourceId,
    })),
  } as unknown as StatisticsState;
  const startDay = jstDay(state.startedAt);
  const lastDay = jstDay(state.lastCollectedAt);
  if (
    state.reports.length > 365 ||
    state.collectionDays.length > 366 ||
    new Set(state.collectionDays).size !== state.collectionDays.length ||
    new Set(state.observations.map(observationKey)).size !== state.observations.length ||
    new Set(state.reports.map((report) => report.date)).size !== state.reports.length ||
    state.collectionDays.some((day) => day < startDay || day > lastDay) ||
    state.observations.some(
      (item) => item.publishedAt > state.lastCollectedAt || jstDay(item.publishedAt) < startDay,
    ) ||
    state.reports.some(
      (report) => report.date < startDay || report.date >= lastDay || report.updatedAt > state.lastCollectedAt,
    )
  ) {
    throw new Error('日次統計の保存履歴に重複または日時の不整合があります');
  }
  return {
    schemaVersion: 2,
    startedAt: state.startedAt,
    lastCollectedAt: state.lastCollectedAt,
    collectionDays: state.collectionDays,
    observations: state.observations.map(({ articleId, sourceId, sectionId, sectionTitle, publishedAt }) => ({
      articleId,
      sourceId,
      sectionId,
      sectionTitle,
      publishedAt,
    })),
    reports: state.reports.map(({ date, publishedAt, updatedAt, coverage, categories }) => ({
      date,
      publishedAt,
      updatedAt,
      coverage,
      categories: categories.map(({ sectionId, title, count }) => ({ sectionId, title, count })),
    })),
  };
};

/** 保存履歴が存在しない場合だけnullを返す。 */
export const readStatisticsState = async (directory: string): Promise<StatisticsState | null> => {
  const file = path.join(directory, 'state.json');
  try {
    const info = await fs.lstat(file);
    if (!info.isFile() || info.size > statisticsConfig.maxStateBytes)
      throw new Error('日次統計の保存ファイルが不正です');
    const data = await fs.readFile(file, 'utf-8');
    if (Buffer.byteLength(data) > statisticsConfig.maxStateBytes) throw new Error('日次統計の保存上限を超えています');
    return parseStatisticsState(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

/** ファイル単位で完全な内容を保存する。 */
export const writeStatisticsFile = async (directory: string, fileName: string, content: string): Promise<void> => {
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `${fileName}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, content, 'utf-8');
    await fs.rename(temporary, path.join(directory, fileName));
  } finally {
    await fs.rm(temporary, { force: true });
  }
};
