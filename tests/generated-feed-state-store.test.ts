import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GeneratedFeedStateStore } from '../src/feed/generated/state-store';

const temporaryDirectories: string[] = [];

const createDirectory = async (): Promise<string> => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'generated-feed-state-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true })));
});

describe('GeneratedFeedStateStore', () => {
  it('パスに使用できない生成フィードIDを拒否する', async () => {
    const rootDirectory = await createDirectory();

    await expect(new GeneratedFeedStateStore().read(rootDirectory, '../outside')).rejects.toThrow(
      '生成フィードID「../outside」が不正です',
    );
  });

  it('保存先と異なるIDのスナップショットを拒否する', async () => {
    const rootDirectory = await createDirectory();
    const feedDirectory = path.join(rootDirectory, 'expected-id');
    await fs.mkdir(feedDirectory, { recursive: true });
    await fs.writeFile(
      path.join(feedDirectory, 'snapshot.json'),
      JSON.stringify({
        schemaVersion: 1,
        id: 'different-id',
        definitionHash: 'hash',
        label: 'テスト',
        pageUrl: 'https://example.com/',
        language: 'ja',
        contentUpdatedAt: '2026-09-06T00:00:00.000Z',
        items: [],
      }),
      'utf-8',
    );

    await expect(new GeneratedFeedStateStore().read(rootDirectory, 'expected-id')).rejects.toThrow(
      '保存済みIDが一致しません',
    );
  });

  it('公開できない記事URLを含むスナップショットを拒否する', async () => {
    const rootDirectory = await createDirectory();
    const feedDirectory = path.join(rootDirectory, 'test-feed');
    await fs.mkdir(feedDirectory, { recursive: true });
    await fs.writeFile(
      path.join(feedDirectory, 'snapshot.json'),
      JSON.stringify({
        schemaVersion: 1,
        id: 'test-feed',
        definitionHash: 'hash',
        label: 'テスト',
        pageUrl: 'https://example.com/',
        language: 'ja',
        contentUpdatedAt: '2026-09-06T00:00:00.000Z',
        items: [
          {
            id: 'javascript:alert(document.domain)',
            title: '記事',
            url: 'javascript:alert(document.domain)',
            publishedAt: '2026-09-05T00:00:00.000Z',
            summary: '',
            categories: [],
            creator: '',
          },
        ],
      }),
      'utf-8',
    );

    await expect(new GeneratedFeedStateStore().read(rootDirectory, 'test-feed')).rejects.toThrow(
      'スナップショットが不正です',
    );
  });
});
