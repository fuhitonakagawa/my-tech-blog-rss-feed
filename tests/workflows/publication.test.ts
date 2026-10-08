import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const verifyPages = require('../../.github/scripts/verify-pages.cjs');
const acquisition = require('../../.github/scripts/acquisition-history.cjs');
let directory: string;
const context = { repo: { owner: 'owner', repo: 'repo' } };
const core = { info: vi.fn(), warning: vi.fn() };
const manifest = { schemaVersion: 2, updatedAt: '2026-10-08T00:00:00.000Z', feeds: { test: { sha256: 'digest' } } };
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rss-workflows-'));
  await fs.writeFile(path.join(directory, 'index.json'), JSON.stringify(manifest));
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(async () => {
  vi.useRealTimers();
  vi.clearAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});
const run = (attempt: number, conclusion: string) => ({
  id: 1,
  path: 'dynamic/pages/pages-build-deployment',
  html_url: 'https://github.com/owner/repo/actions/runs/1',
  run_attempt: attempt,
  status: 'completed',
  conclusion,
});
const fixture = () => ({
  rest: {
    repos: { getBranch: vi.fn().mockResolvedValue({ data: { commit: { sha: 'deployed' } } }) },
    actions: { listWorkflowRunsForRepo: vi.fn(), reRunWorkflowFailedJobs: vi.fn().mockResolvedValue({}) },
  },
});
const options = () => ({
  manifest: path.join(directory, 'index.json'),
  timeout: 100_000,
  pause: async (ms: number) => {
    vi.setSystemTime(Date.now() + ms);
  },
  fetch: vi.fn().mockResolvedValue({ ok: true, json: async () => manifest }),
});

it('配置コミットのPagesが一時失敗したら再試行し、実URLへの反映まで待つ', async () => {
  const github = fixture();
  github.rest.actions.listWorkflowRunsForRepo
    .mockResolvedValueOnce({ data: { workflow_runs: [run(1, 'failure')] } })
    .mockResolvedValueOnce({ data: { workflow_runs: [run(1, 'failure')] } })
    .mockResolvedValue({ data: { workflow_runs: [run(2, 'success')] } });
  const config = options();
  config.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...manifest, updatedAt: 'old' }) });
  await verifyPages({ github, context, core }, config);
  expect(github.rest.actions.reRunWorkflowFailedJobs).toHaveBeenCalledTimes(1);
  expect(config.fetch).toHaveBeenCalledTimes(2);
  expect(github.rest.actions.listWorkflowRunsForRepo).toHaveBeenCalledWith(
    expect.objectContaining({ head_sha: 'deployed' }),
  );
});

it('Pagesが成功でも実URLが古いままなら生成ワークフローを失敗させる', async () => {
  const github = fixture();
  github.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({ data: { workflow_runs: [run(1, 'success')] } });
  const config = options();
  config.fetch.mockResolvedValue({ ok: true, json: async () => ({ ...manifest, updatedAt: 'old' }) });
  await expect(verifyPages({ github, context, core }, config)).rejects.toThrow('期限内');
});

it('Pagesの失敗が続けば再試行は2回で止め、緑表示にしない', async () => {
  const github = fixture();
  let attempt = 0;
  github.rest.actions.listWorkflowRunsForRepo.mockImplementation(async () => ({
    data: { workflow_runs: [run(++attempt, 'failure')] },
  }));
  await expect(verifyPages({ github, context, core }, options())).rejects.toThrow('再試行後');
  expect(github.rest.actions.reRunWorkflowFailedJobs).toHaveBeenCalledTimes(2);
});

it('取得記録の読み込み権限エラーを初回扱いにせず、不正パスを保存しない', async () => {
  const github = { rest: { git: { getRef: vi.fn().mockRejectedValue({ status: 403 }), createBlob: vi.fn() } } };
  await expect(acquisition.restore({ github, context, core }, directory)).rejects.toMatchObject({ status: 403 });
  expect(await fs.readdir(directory)).toEqual(['index.json']);
  github.rest.git.getRef.mockRejectedValue({ status: 404 });
  await acquisition.restore({ github, context, core }, directory);
  await fs.writeFile(path.join(directory, 'index.json'), '{}');
  await fs.writeFile(path.join(directory, 'secret.txt'), 'invalid');
  await expect(acquisition.save({ github, context, core }, directory)).rejects.toThrow('許可されていない');
  expect(github.rest.git.createBlob).not.toHaveBeenCalled();
});

it('取得記録を専用ブランチから復元し、復元後に更新されたブランチを上書きしない', async () => {
  let head: string | null = null;
  let serial = 0;
  const blobs = new Map<string, string>();
  const trees = new Map<string, { path: string; mode: string; type: string; sha: string; size: number }[]>();
  const commits = new Map<string, string>();
  const git = {
    getRef: vi.fn(async () => {
      if (!head) throw { status: 404 };
      return { data: { object: { sha: head } } };
    }),
    createBlob: vi.fn(async ({ content }: { content: string }) => {
      const sha = `blob-${++serial}`;
      blobs.set(sha, content);
      return { data: { sha } };
    }),
    createTree: vi.fn(async ({ tree }: { tree: { path: string; mode: string; type: string; sha: string }[] }) => {
      const sha = `tree-${++serial}`;
      trees.set(
        sha,
        tree.map((entry) => ({ ...entry, size: Buffer.byteLength(blobs.get(entry.sha) ?? '') })),
      );
      return { data: { sha } };
    }),
    createCommit: vi.fn(async ({ tree }: { tree: string }) => {
      const sha = `commit-${++serial}`;
      commits.set(sha, tree);
      return { data: { sha } };
    }),
    createRef: vi.fn(async ({ sha }: { sha: string }) => {
      head = sha;
      return {};
    }),
    updateRef: vi.fn(async ({ sha, force }: { sha: string; force: boolean }) => {
      expect(force).toBe(false);
      head = sha;
      return {};
    }),
    getCommit: vi.fn(async ({ commit_sha }: { commit_sha: string }) => ({
      data: { tree: { sha: commits.get(commit_sha) } },
    })),
    getTree: vi.fn(async ({ tree_sha }: { tree_sha: string }) => ({
      data: { tree: trees.get(tree_sha), truncated: false },
    })),
    getBlob: vi.fn(async ({ file_sha }: { file_sha: string }) => ({
      data: { encoding: 'base64', content: Buffer.from(blobs.get(file_sha) ?? '').toString('base64') },
    })),
  };
  const github = { rest: { git } };
  await fs.writeFile(path.join(directory, 'index.json'), JSON.stringify({ baseCommit: null }));
  const name = `feed-acquisition-v1-${'a'.repeat(64)}.json`;
  await fs.writeFile(
    path.join(directory, name),
    JSON.stringify({ sourceUrl: 'https://example.com/rss', items: ['captured'] }),
  );
  await acquisition.save({ github, context, core }, directory);
  const restored = await acquisition.restore({ github, context, core }, directory);
  expect(JSON.parse(await fs.readFile(path.join(directory, name), 'utf8')).items).toEqual(['captured']);
  await fs.writeFile(path.join(directory, 'index.json'), JSON.stringify({ baseCommit: restored }));
  await acquisition.save({ github, context, core }, directory);
  expect(git.updateRef).toHaveBeenCalledTimes(1);
  const saved = head;
  await expect(acquisition.save({ github, context, core }, directory)).rejects.toThrow('復元後に更新');
  expect(head).toBe(saved);
});

it('失敗バックアップは本番だけを選び、PR実行と期限切れを採用しない', async () => {
  const list = vi.fn();
  const artifacts = vi
    .fn()
    .mockResolvedValueOnce({ data: { artifacts: [{ name: 'acquired-articles', expired: true }] } })
    .mockResolvedValueOnce({ data: { artifacts: [{ name: 'acquired-articles', expired: false }] } });
  const github = {
    rest: { actions: { listWorkflowRuns: list, listWorkflowRunArtifacts: artifacts } },
    paginate: vi.fn().mockResolvedValue([
      { id: 1, event: 'pull_request' },
      { id: 2, event: 'push' },
      { id: 3, event: 'schedule' },
    ]),
  };
  expect(await acquisition.findFailedBackup({ github, context, core }, 'generate-feed.yml', 'acquired-articles')).toBe(
    '3',
  );
  expect(artifacts).toHaveBeenCalledTimes(2);
  expect(github.paginate).toHaveBeenCalledWith(list, expect.objectContaining({ branch: 'main', status: 'failure' }));
});
