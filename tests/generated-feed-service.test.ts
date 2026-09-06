import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import RssParser from 'rss-parser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneratedFeedService } from '../src/feed/generated/generated-feed-service';
import type { GeneratedFeedDefinition, GeneratedFeedStatus } from '../src/feed/generated/types';
import { logger } from '../src/feed/logger';

const temporaryDirectories: string[] = [];

const definition: GeneratedFeedDefinition = {
  id: 'test-blog',
  schemaVersion: 1,
  label: 'テストブログ',
  pageUrl: 'https://example.com/blog/',
  language: 'ja',
  extractor: {
    type: 'css',
    itemSelector: 'article',
    titleSelector: 'h2',
    linkSelector: 'a',
    dateSelector: 'time',
    dateAttribute: 'datetime',
    timeZoneOffset: 'Z',
  },
  pollIntervalMinutes: 60,
  maxItems: 50,
};

const createHtml = (id: string, title: string, publishedAt: string): string => `
  <article>
    <a href="/articles/${id}"><h2>${title}</h2></a>
    <time datetime="${publishedAt}"></time>
  </article>
`;

const createDirectories = async (): Promise<{ previous: string; output: string }> => {
  const rootDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'generated-feed-service-'));
  temporaryDirectories.push(rootDirectory);
  return {
    previous: path.join(rootDirectory, 'previous'),
    output: path.join(rootDirectory, 'output'),
  };
};

const readStatus = async (rootDirectory: string): Promise<GeneratedFeedStatus> => {
  return JSON.parse(
    await fs.readFile(path.join(rootDirectory, definition.id, 'status.json'), 'utf-8'),
  ) as GeneratedFeedStatus;
};

beforeEach(() => {
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'trace').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true })));
});

describe('GeneratedFeedService', () => {
  it('単独RSSを保存し、同じXMLを内部レジストリへ登録する', async () => {
    const directories = await createDirectories();
    const pageFetcher = vi.fn(async () => createHtml('first', '最初の記事', '2026-09-05T12:00:00Z'));
    const service = new GeneratedFeedService(pageFetcher, () => new Date('2026-09-06T00:00:00Z'));

    const registry = await service.generate([definition], directories.previous, directories.output);
    const storedRss = await fs.readFile(path.join(directories.output, definition.id, 'rss.xml'), 'utf-8');
    const parsedFeed = await new RssParser().parseString(storedRss);

    expect(pageFetcher).toHaveBeenCalledOnce();
    expect(registry.get(definition.id)).toBe(storedRss);
    expect(parsedFeed.items).toHaveLength(1);
    expect(parsedFeed.items[0].guid).toBe('https://example.com/articles/first');
    expect(parsedFeed.items[0].isoDate).toBe('2026-09-05T12:00:00.000Z');
    expect(await readStatus(directories.output)).toMatchObject({
      state: 'ok',
      contentUpdatedAt: '2026-09-06T00:00:00.000Z',
    });
  });

  it('前回記事と今回記事を統合し、同じ記事IDは今回内容を優先する', async () => {
    const directories = await createDirectories();
    const firstService = new GeneratedFeedService(
      async () => createHtml('first', '変更前タイトル', '2026-09-05T12:00:00Z'),
      () => new Date('2026-09-06T00:00:00Z'),
    );
    await firstService.generate([definition], directories.previous, directories.previous);
    const secondHtml = [
      createHtml('second', '新しい記事', '2026-09-06T12:00:00Z'),
      createHtml('first', '変更後タイトル', '2026-09-05T12:00:00Z'),
    ].join('');
    const secondService = new GeneratedFeedService(
      async () => secondHtml,
      () => new Date('2026-09-06T02:00:00Z'),
    );

    const registry = await secondService.generate([definition], directories.previous, directories.output);
    const feed = await new RssParser().parseString(registry.get(definition.id) ?? '');

    expect(feed.items.map((item) => item.title)).toEqual(['新しい記事', '変更後タイトル']);
  });

  it('統合後の記事を公開日時順で上限件数まで保持する', async () => {
    const directories = await createDirectories();
    const limitedDefinition = { ...definition, maxItems: 2 };
    const html = [
      createHtml('first', '1件目', '2026-09-04T12:00:00Z'),
      createHtml('second', '2件目', '2026-09-05T12:00:00Z'),
      createHtml('third', '3件目', '2026-09-06T12:00:00Z'),
    ].join('');

    const registry = await new GeneratedFeedService(
      async () => html,
      () => new Date('2026-09-07T00:00:00Z'),
    ).generate([limitedDefinition], directories.previous, directories.output);
    const feed = await new RssParser().parseString(registry.get(definition.id) ?? '');

    expect(feed.items.map((item) => item.title)).toEqual(['3件目', '2件目']);
  });

  it('内容が同じ再取得ではフィード内容の更新日時を維持する', async () => {
    const directories = await createDirectories();
    const html = createHtml('first', '最初の記事', '2026-09-05T12:00:00Z');
    await new GeneratedFeedService(
      async () => html,
      () => new Date('2026-09-06T00:00:00Z'),
    ).generate([definition], directories.previous, directories.previous);
    const previousRss = await fs.readFile(path.join(directories.previous, definition.id, 'rss.xml'), 'utf-8');

    const registry = await new GeneratedFeedService(
      async () => html,
      () => new Date('2026-09-06T02:00:00Z'),
    ).generate([definition], directories.previous, directories.output);

    expect(registry.get(definition.id)).toBe(previousRss);
    expect(await readStatus(directories.output)).toMatchObject({
      state: 'ok',
      lastCheckedAt: '2026-09-06T02:00:00.000Z',
      contentUpdatedAt: '2026-09-06T00:00:00.000Z',
    });
  });

  it('取得設定だけが変わり配信内容が同じ場合は内容の更新日時を維持する', async () => {
    const directories = await createDirectories();
    const html = createHtml('first', '最初の記事', '2026-09-05T12:00:00Z');
    await new GeneratedFeedService(
      async () => html,
      () => new Date('2026-09-06T00:00:00Z'),
    ).generate([definition], directories.previous, directories.previous);
    const changedPollingDefinition = { ...definition, pollIntervalMinutes: 120 };

    await new GeneratedFeedService(
      async () => html,
      () => new Date('2026-09-06T02:00:00Z'),
    ).generate([changedPollingDefinition], directories.previous, directories.output);

    expect(await readStatus(directories.output)).toMatchObject({
      contentUpdatedAt: '2026-09-06T00:00:00.000Z',
    });
  });

  it('最小確認間隔内は生成元を再取得しない', async () => {
    const directories = await createDirectories();
    const html = createHtml('first', '最初の記事', '2026-09-05T12:00:00Z');
    await new GeneratedFeedService(
      async () => html,
      () => new Date('2026-09-06T00:00:00Z'),
    ).generate([definition], directories.previous, directories.previous);
    const pageFetcher = vi.fn(async () => html);

    const registry = await new GeneratedFeedService(pageFetcher, () => new Date('2026-09-06T00:30:00Z')).generate(
      [definition],
      directories.previous,
      directories.output,
    );

    expect(pageFetcher).not.toHaveBeenCalled();
    expect(registry.has(definition.id)).toBe(true);
    expect(await readStatus(directories.output)).toMatchObject({
      state: 'ok',
      lastCheckedAt: '2026-09-06T00:00:00.000Z',
    });
  });

  it('生成元の障害時は前回正常RSSを維持する', async () => {
    const directories = await createDirectories();
    await new GeneratedFeedService(
      async () => createHtml('first', '最初の記事', '2026-09-05T12:00:00Z'),
      () => new Date('2026-09-06T00:00:00Z'),
    ).generate([definition], directories.previous, directories.previous);
    const previousRss = await fs.readFile(path.join(directories.previous, definition.id, 'rss.xml'), 'utf-8');
    const failingService = new GeneratedFeedService(
      async () => {
        throw new Error('network error');
      },
      () => new Date('2026-09-06T02:00:00Z'),
    );

    const registry = await failingService.generate([definition], directories.previous, directories.output);

    expect(registry.get(definition.id)).toBe(previousRss);
    expect(await readStatus(directories.output)).toMatchObject({
      state: 'stale',
      lastCheckedAt: '2026-09-06T02:00:00.000Z',
      lastSuccessfulAt: '2026-09-06T00:00:00.000Z',
    });
  });

  it('前回確認が失敗している場合は最小確認間隔内でも再取得する', async () => {
    const directories = await createDirectories();
    const html = createHtml('first', '最初の記事', '2026-09-05T12:00:00Z');
    await new GeneratedFeedService(
      async () => html,
      () => new Date('2026-09-06T00:00:00Z'),
    ).generate([definition], directories.previous, directories.previous);
    await new GeneratedFeedService(
      async () => {
        throw new Error('network error');
      },
      () => new Date('2026-09-06T02:00:00Z'),
    ).generate([definition], directories.previous, directories.output);
    const pageFetcher = vi.fn(async () => html);
    const recoveredOutput = path.join(path.dirname(directories.output), 'recovered');

    await new GeneratedFeedService(pageFetcher, () => new Date('2026-09-06T02:05:00Z')).generate(
      [definition],
      directories.output,
      recoveredOutput,
    );

    expect(pageFetcher).toHaveBeenCalledOnce();
    expect(await readStatus(recoveredOutput)).toMatchObject({
      state: 'ok',
      lastCheckedAt: '2026-09-06T02:05:00.000Z',
    });
  });

  it('初回生成に失敗した場合は購読ファイルを作らない', async () => {
    const directories = await createDirectories();
    const service = new GeneratedFeedService(
      async () => {
        throw new Error('network error');
      },
      () => new Date('2026-09-06T00:00:00Z'),
    );

    const registry = await service.generate([definition], directories.previous, directories.output);

    expect(registry.has(definition.id)).toBe(false);
    await expect(fs.access(path.join(directories.output, definition.id, 'rss.xml'))).rejects.toThrow();
    expect(await readStatus(directories.output)).toMatchObject({
      state: 'unavailable',
      lastSuccessfulAt: null,
      contentUpdatedAt: null,
    });
  });

  it('1つの生成元が失敗しても他の生成元を処理する', async () => {
    const directories = await createDirectories();
    const secondDefinition: GeneratedFeedDefinition = {
      ...definition,
      id: 'second-blog',
      label: '2つ目のブログ',
      pageUrl: 'https://example.net/blog/',
    };
    const service = new GeneratedFeedService(
      async (targetDefinition) => {
        if (targetDefinition.id === definition.id) {
          throw new Error('network error');
        }
        return createHtml('second', '2つ目の記事', '2026-09-05T12:00:00Z');
      },
      () => new Date('2026-09-06T00:00:00Z'),
    );

    const registry = await service.generate([definition, secondDefinition], directories.previous, directories.output);

    expect(registry.has(definition.id)).toBe(false);
    expect(registry.has(secondDefinition.id)).toBe(true);
  });

  it('未登録のアダプター参照は処理開始前に拒否する', async () => {
    const directories = await createDirectories();
    const invalidDefinition: GeneratedFeedDefinition = {
      ...definition,
      extractor: {
        type: 'adapter',
        name: 'unknown-adapter',
      },
    };

    await expect(
      new GeneratedFeedService().generate([invalidDefinition], directories.previous, directories.output),
    ).rejects.toThrow('生成フィードの抽出アダプター「unknown-adapter」が登録されていません');
  });
});
