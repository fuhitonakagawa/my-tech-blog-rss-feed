import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { statisticsConfig } from '../../../src/feed/statistics/config';
import { readStatisticsState, serializeStatisticsState } from '../../../src/feed/statistics/state-store';
import type { StatisticsState } from '../../../src/feed/statistics/types';

vi.mock('../../../src/feed/statistics/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/feed/statistics/config')>();
  return {
    ...actual,
    statisticsConfig: { ...actual.statisticsConfig, maxStateBytes: 4096, maxDecodedStateBytes: 65536 },
  };
});

const state = (count = 50, random = false): StatisticsState => ({
  schemaVersion: 3,
  startedAt: '2026-09-27T00:00:00.000Z',
  lastCollectedAt: '2026-09-27T01:00:00.000Z',
  collectionDays: ['2026-09-27'],
  observations: Array.from({ length: count }, (_, index) => ({
    articleId: random ? randomBytes(32).toString('hex') : index.toString(16).padStart(64, '0'),
    sourceId: 'a'.repeat(64),
    sectionId: 'ai',
    sectionTitle: '日本語カテゴリ',
    publishedAt: '2026-09-27T00:00:00.000Z',
    inTranslatedFeed: index % 2 === 0,
  })),
  reports: [],
});

let directory: string;
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'statistics-state-'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});

it('未圧縮の保存上限を超えても全取得記録と翻訳掲載記録を圧縮して復元する', async () => {
  const original = state();
  expect(Buffer.byteLength(JSON.stringify(original))).toBeGreaterThan(statisticsConfig.maxStateBytes);
  const content = await serializeStatisticsState(original);
  expect(content.byteLength).toBeLessThan(statisticsConfig.maxStateBytes);
  expect(JSON.parse(gunzipSync(content).toString('utf-8'))).toEqual(original);
  await fs.writeFile(path.join(directory, 'state.json.gz'), content);
  expect(await readStatisticsState(directory)).toEqual(original);
});

it('初回はnullを返し、旧JSONと併存する場合は圧縮履歴を優先する', async () => {
  expect(await readStatisticsState(directory)).toBeNull();
  await fs.writeFile(path.join(directory, 'state.json'), JSON.stringify(state(1)));
  expect(await readStatisticsState(directory)).toEqual(state(1));
  await fs.writeFile(path.join(directory, 'state.json.gz'), await serializeStatisticsState(state()));
  expect(await readStatisticsState(directory)).toEqual(state());
});

it('圧縮で小さくても展開上限を超える履歴を保存・復元しない', async () => {
  const original = state(300);
  await expect(serializeStatisticsState(original)).rejects.toThrow('展開上限');
  const content = gzipSync(JSON.stringify(original));
  expect(content.byteLength).toBeLessThan(statisticsConfig.maxStateBytes);
  await fs.writeFile(path.join(directory, 'state.json.gz'), content);
  await expect(readStatisticsState(directory)).rejects.toMatchObject({ code: 'ERR_BUFFER_TOO_LARGE' });
});

it('展開後のバイト数が上限と一致するJSONを復元し、1バイト超過は拒否する', async () => {
  const json = JSON.stringify(state());
  const padded = json + ' '.repeat(statisticsConfig.maxDecodedStateBytes - Buffer.byteLength(json));
  await fs.writeFile(path.join(directory, 'state.json.gz'), gzipSync(padded));
  expect(await readStatisticsState(directory)).toEqual(state());
  await fs.writeFile(path.join(directory, 'state.json.gz'), gzipSync(`${padded} `));
  await expect(readStatisticsState(directory)).rejects.toMatchObject({ code: 'ERR_BUFFER_TOO_LARGE' });
});

it('圧縮後も保存上限を超える履歴を保存・復元しない', async () => {
  const original = state(150, true);
  await expect(serializeStatisticsState(original)).rejects.toThrow('保存上限');
  await fs.writeFile(path.join(directory, 'state.json.gz'), gzipSync(JSON.stringify(original)));
  await expect(readStatisticsState(directory)).rejects.toThrow('不正');
});

it('旧JSONも保存上限を超えた場合は拒否する', async () => {
  await fs.writeFile(path.join(directory, 'state.json'), JSON.stringify(state()));
  await expect(readStatisticsState(directory)).rejects.toThrow('不正');
});

it.each(['broken', 'truncated', 'invalid-state', 'symlink', 'directory'])(
  '不正な圧縮履歴から正常な旧JSONへ切り替えない: %s',
  async (kind) => {
    await fs.writeFile(path.join(directory, 'state.json'), JSON.stringify(state(1)));
    const file = path.join(directory, 'state.json.gz');
    if (kind === 'broken') await fs.writeFile(file, 'invalid gzip');
    if (kind === 'truncated') await fs.writeFile(file, (await serializeStatisticsState(state())).subarray(0, 20));
    if (kind === 'invalid-state') await fs.writeFile(file, gzipSync('{}'));
    if (kind === 'symlink') await fs.symlink(path.join(directory, 'state.json'), file);
    if (kind === 'directory') await fs.mkdir(file);
    await expect(readStatisticsState(directory)).rejects.toThrow();
  },
);

it('圧縮履歴でも重複した記事を拒否する', async () => {
  const invalid = state(1);
  invalid.observations.push(invalid.observations[0]);
  await expect(serializeStatisticsState(invalid)).rejects.toThrow('重複');
  await fs.writeFile(path.join(directory, 'state.json.gz'), gzipSync(JSON.stringify(invalid)));
  await expect(readStatisticsState(directory)).rejects.toThrow('重複');
});

it('展開後の上限に近づくと保存サイズを含むActions警告を出す', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  await serializeStatisticsState(state(180));
  expect(warning).toHaveBeenCalledWith(expect.stringMatching(/^::warning::.*保存時.*展開後/));
});
