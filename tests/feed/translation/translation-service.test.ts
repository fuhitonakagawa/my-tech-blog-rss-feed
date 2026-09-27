import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../../src/feed/logger';
import { TranslationCache, translationCacheKey } from '../../../src/feed/translation/translation-cache';
import { TranslationService } from '../../../src/feed/translation/translation-service';
import type { Translator } from '../../../src/feed/translation/translator';
import { makeSourceItem } from '../../helpers/translation-fixtures';

let directory: string;
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'translation-test-'));
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(directory, { recursive: true, force: true });
});

describe('TranslationService', () => {
  it('翻訳結果の不正な制御文字を除去し、改行は空白として配信する', async () => {
    const translateMany = vi.fn(async (): Promise<string[]> => ['新しい\u0000API', 'アプリ\nを構築\u0007']);
    const cache = new TranslationCache(directory);
    const service = new TranslationService({ id: 'fake:v1', translateMany }, cache);
    const [result] = await service.translateItems([makeSourceItem()], 'en', 'ja');
    expect(result.title).toBe('新しいAPI');
    expect(result.summary).toBe('アプリ を構築');
    expect(await cache.read(translationCacheKey('fake:v1', 'en', 'ja', 'New API'))).toBe('新しいAPI');
  });
  it('タイトルと概要を一括翻訳し、原文・公開情報を維持する', async () => {
    const translateMany = vi.fn(async (): Promise<string[]> => ['新しいAPI', 'アプリを構築']);
    const service = new TranslationService({ id: 'fake:v1', translateMany }, new TranslationCache(directory));
    const item = Object.freeze(makeSourceItem());
    const result = await service.translateItems([item], 'en', 'ja');
    expect(translateMany).toHaveBeenCalledWith(['New API', 'Build apps'], 'en', 'ja');
    expect(result[0]).toEqual({
      ...item,
      originalTitle: 'New API',
      title: '新しいAPI',
      summary: 'アプリを構築',
      contentSnippet: 'アプリを構築',
    });
    expect(item).toEqual(makeSourceItem());
  });

  it('同一原文をまとめ、キャッシュをプロセス間でも利用する', async () => {
    const translateMany = vi.fn(async (texts: string[]): Promise<string[]> => texts.map((text) => `日本語:${text}`));
    const provider: Translator = { id: 'fake:v1', translateMany };
    const items = [makeSourceItem(), makeSourceItem({ link: 'https://example.com/other' })];
    await new TranslationService(provider, new TranslationCache(directory)).translateItems(items, 'en', 'ja');
    expect(translateMany.mock.calls[0][0]).toEqual(['New API', 'Build apps']);
    const result = await new TranslationService(provider, new TranslationCache(directory)).translateItems(
      items,
      'en',
      'ja',
    );
    expect(translateMany).toHaveBeenCalledTimes(1);
    expect(result.every((item) => item.title === '日本語:New API')).toBe(true);
  });

  it('概要だけの更新はタイトルのキャッシュを保持する', async () => {
    const translateMany = vi.fn(async (texts: string[]): Promise<string[]> => texts.map((text) => `日本語:${text}`));
    const service = new TranslationService({ id: 'fake:v1', translateMany }, new TranslationCache(directory));
    await service.translateItems([makeSourceItem()], 'en', 'ja');
    await service.translateItems([makeSourceItem({ summary: 'Updated summary' })], 'en', 'ja');
    expect(translateMany.mock.calls[1][0]).toEqual(['Updated summary']);
  });

  it.each(['other-provider:v1', 'fake:v2'])('プロバイダーまたはモデル変更では再翻訳する: %s', async (id) => {
    const translateMany = vi.fn(async (texts: string[]): Promise<string[]> => texts.map((text) => `日本語:${text}`));
    await new TranslationService({ id: 'fake:v1', translateMany }, new TranslationCache(directory)).translateItems(
      [makeSourceItem()],
      'en',
      'ja',
    );
    await new TranslationService({ id, translateMany }, new TranslationCache(directory)).translateItems(
      [makeSourceItem()],
      'en',
      'ja',
    );
    expect(translateMany).toHaveBeenCalledTimes(2);
  });

  it('contentSnippetを概要として翻訳し、空の概要を翻訳器へ渡さない', async () => {
    const translateMany = vi.fn(async (texts: string[]): Promise<string[]> => texts.map((text) => `日本語:${text}`));
    const service = new TranslationService({ id: 'fake:v1', translateMany }, new TranslationCache(directory));
    const results = await service.translateItems(
      [makeSourceItem({ summary: '', contentSnippet: 'Snippet' }), makeSourceItem({ summary: '', contentSnippet: '' })],
      'en',
      'ja',
    );
    expect(translateMany.mock.calls[0][0]).toEqual(['New API', 'Snippet']);
    expect(results[0].summary).toBe('日本語:Snippet');
    expect(results[1].summary).toBe('');
  });

  it('部分失敗した記事はタイトル・概要ともに原文を保持し、失敗はキャッシュしない', async () => {
    const translateMany = vi.fn(async (): Promise<string[]> => ['新しいAPI', '']);
    const service = new TranslationService({ id: 'fake:v1', translateMany }, new TranslationCache(directory));
    const item = makeSourceItem();
    expect(await service.translateItems([item], 'en', 'ja')).toEqual([{ ...item, originalTitle: item.title }]);
    translateMany.mockResolvedValue(['概要']);
    const result = await service.translateItems([item], 'en', 'ja');
    expect(translateMany).toHaveBeenLastCalledWith(['Build apps'], 'en', 'ja');
    expect(result[0].title).toBe('新しいAPI');
    expect(result[0].summary).toBe('概要');
  });

  it('プロバイダー障害や不正な結果でも元記事を削除しない', async () => {
    const translateMany = vi.fn(async (): Promise<string[]> => {
      throw new Error('unavailable');
    });
    const service = new TranslationService({ id: 'fake:v1', translateMany }, new TranslationCache(directory));
    const item = makeSourceItem();
    expect(await service.translateItems([item], 'en', 'ja')).toEqual([{ ...item, originalTitle: item.title }]);
    translateMany.mockResolvedValue(['件数不一致']);
    expect(await service.translateItems([item], 'en', 'ja')).toEqual([{ ...item, originalTitle: item.title }]);
    expect(await fs.readdir(directory)).toEqual([]);
  });

  it('翻訳対象が空の場合は翻訳器を呼び出さない', async () => {
    const translateMany = vi.fn();
    const service = new TranslationService({ id: 'fake:v1', translateMany }, new TranslationCache(directory));
    expect(await service.translateItems([], 'en', 'ja')).toEqual([]);
    expect(translateMany).not.toHaveBeenCalled();
  });
});

describe('TranslationCache', () => {
  it('壊れたキャッシュをmissとして扱い、正しい結果で置き換えられる', async () => {
    const key = translationCacheKey('fake:v1', 'en', 'ja', 'Title');
    await fs.writeFile(path.join(directory, `${key}.json`), 'broken');
    const cache = new TranslationCache(directory);
    expect(await cache.read(key)).toBeUndefined();
    await cache.write(key, 'タイトル');
    expect(await cache.read(key)).toBe('タイトル');
  });

  it('ディレクトリ外を指すキーを拒否する', async () => {
    await expect(new TranslationCache(directory).read('../secret')).rejects.toThrow('キーが不正');
  });

  it('翻訳方向でキーを分離する', () => {
    expect(translationCacheKey('fake:v1', 'en', 'ja', 'Title')).not.toBe(
      translationCacheKey('fake:v1', 'en', 'fr', 'Title'),
    );
  });
});
