import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { buildHealthReport, writeFeedHealth } from '../../../src/feed/health/service';
import { parseHealthHistory } from '../../../src/feed/health/state-store';
import type { SourceFetchObservation } from '../../../src/feed/health/types';
import type { FeedInfo } from '../../../src/resources/feed-info-list';
import { makeSourceItem } from '../../helpers/translation-fixtures';

const definition: FeedInfo = {
  label: 'Source',
  url: 'https://example.com/feed',
  input: { kind: 'remote', url: 'https://example.com/feed' },
  language: 'en',
  sectionId: 'ai',
};
const now = new Date('2026-09-30T12:00:00.000Z');
const cutoff = new Date('2026-09-22T12:00:00.000Z');
const observation = (status: SourceFetchObservation['status']): SourceFetchObservation[] => [
  { sourceUrl: definition.url, status, httpStatus: status === 'error' ? 403 : null },
];
afterEach(() => vi.unstubAllEnvs());

it('期間外・未来・日時欠落・識別子不正を区別し、空フィードを取得失敗と混同しない', () => {
  const items = [now.toISOString(), '2026-09-20T12:00:00.000Z', '2026-10-01T00:00:00.000Z', ''].map((isoDate) =>
    makeSourceItem({ isoDate, sourceFeedUrl: definition.url }),
  );
  items.push(makeSourceItem({ isoDate: now.toISOString(), sourceFeedUrl: definition.url, guid: 'x'.repeat(8193) }));
  const report = buildHealthReport([definition], observation('ok'), items, [], undefined, cutoff, now);
  expect(report.sources[0]).toMatchObject({
    received: 5,
    eligible: 1,
    excluded: { missingDate: 1, outsideWindow: 1, future: 1, invalidIdentifier: 1 },
    lastSuccessfulAt: now.toISOString(),
    consecutiveFailures: 0,
  });
  expect(buildHealthReport([definition], observation('ok'), [], [], report, cutoff, now).sources[0].status).toBe('ok');
});

it('補助経路と途中失敗を正常扱いせず、連続失敗・最終正常時刻を保持する', () => {
  const first = buildHealthReport([definition], observation('ok'), [], [], undefined, cutoff, now);
  const failed = buildHealthReport(
    [definition],
    observation('error'),
    [],
    [],
    first,
    cutoff,
    new Date(now.getTime() + 3600000),
  );
  const partial = buildHealthReport(
    [definition],
    observation('partial'),
    [],
    [],
    failed,
    cutoff,
    new Date(now.getTime() + 7200000),
  );
  expect(partial.sources[0]).toMatchObject({ consecutiveFailures: 2, lastSuccessfulAt: now.toISOString() });
  const fallback = buildHealthReport([definition], observation('fallback'), [], [], partial, cutoff, now);
  expect(fallback.sources[0].consecutiveFailures).toBe(3);
  expect(buildHealthReport([definition], [], [], [], undefined, cutoff, now).sources[0].status).toBe('error');
  expect(parseHealthHistory(JSON.stringify([partial]))).toEqual([partial]);
});

it('公開履歴の不正URL・日時・件数・掲載キー・重複を拒否する', () => {
  const report = buildHealthReport([definition], observation('ok'), [], [], undefined, cutoff, now);
  for (const patch of [
    { sourceUrl: 'https://example.com/feed?token=secret' },
    { received: -1 },
    { lastSuccessfulAt: 'invalid' },
    { status: 'unknown' },
  ]) {
    expect(() =>
      parseHealthHistory(JSON.stringify([{ ...report, sources: [{ ...report.sources[0], ...patch }] }])),
    ).toThrow();
  }
  expect(() =>
    parseHealthHistory(JSON.stringify([{ ...report, sources: [...report.sources, ...report.sources] }])),
  ).toThrow();
  expect(() =>
    parseHealthHistory(
      JSON.stringify([{ ...report, coverage: [{ kind: 'normal', id: 'ai', expected: 1, missing: ['bad'] }] }]),
    ),
  ).toThrow();
});

it('公開済み直近48実行を保持し、未公開出力を前回正常の根拠にしない', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'health-'));
  try {
    vi.stubEnv('GITHUB_ACTIONS', 'false');
    vi.stubEnv('GITHUB_STEP_SUMMARY', '');
    const published = path.join(root, 'published');
    const output = path.join(root, 'output');
    const report = buildHealthReport([definition], observation('ok'), [], [], undefined, cutoff, now);
    await fs.mkdir(path.join(published, 'feeds/health'), { recursive: true });
    await fs.writeFile(
      path.join(published, 'feeds/health/history.json'),
      JSON.stringify(Array.from({ length: 48 }, () => report)),
    );
    const result = await writeFeedHealth(published, output, (previous) =>
      buildHealthReport([definition], observation('error'), [], [], previous, cutoff, now),
    );
    expect(result.sources[0].consecutiveFailures).toBe(1);
    const again = await writeFeedHealth(published, output, (previous) =>
      buildHealthReport([definition], observation('error'), [], [], previous, cutoff, now),
    );
    expect(again.sources[0].consecutiveFailures).toBe(1);
    expect(parseHealthHistory(await fs.readFile(path.join(output, 'feeds/health/history.json'), 'utf8'))).toHaveLength(
      48,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
