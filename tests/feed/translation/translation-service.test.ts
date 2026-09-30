import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../../src/feed/logger';
import { TranslationCache, translationCacheKey } from '../../../src/feed/translation/translation-cache';
import { TranslationService } from '../../../src/feed/translation/translation-service';
import type { Translator } from '../../../src/feed/translation/translator';
import { makeSourceItem, testTranslationLimits } from '../../helpers/translation-fixtures';

let directory: string;
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'translation-test-'));
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await fs.rm(directory, { recursive: true, force: true });
});

describe('TranslationService', () => {
  it('翻訳器と保存キャッシュの禁止文字を表示から除き、正常な絵文字を保持する', async () => {
    const cache = new TranslationCache(directory);
    const item = makeSourceItem();
    await cache.write(translationCacheKey('fake:v1', 'en', 'ja', item.title ?? ''), 'キャッシュ\uFFFE😀');
    const service = new TranslationService(
      {
        id: 'fake:v1',
        limits: testTranslationLimits,
        translateMany: async (texts) => texts.map(() => '翻訳\uFFFF\uD800😀'),
      },
      cache,
    );
    const [result] = await service.translateItems([item], 'en', 'ja');
    expect(result).toMatchObject({ title: 'キャッシュ😀', summary: '翻訳😀', guid: item.guid, link: item.link });
  });
  it('失敗バッチの前後を翻訳し、成功分は別プロセス相当の再実行でもキャッシュする', async () => {
    const cache = new TranslationCache(directory);
    const translateMany = vi.fn(async (texts: string[]): Promise<string[]> => {
      if (texts.includes('bad')) throw new Error('バッチ失敗');
      if (texts.includes('after'))
        expect(await cache.read(translationCacheKey('fake:v1', 'en', 'ja', 'before'))).toBe('訳:before');
      return texts.map((text) => `訳:${text}`);
    });
    const provider = { id: 'fake:v1', limits: { ...testTranslationLimits, maxBatchTexts: 2 }, translateMany };
    const items = ['before', 'bad', 'after'].map((name) =>
      makeSourceItem({ title: name, summary: `summary-${name}`, sectionId: name }),
    );
    const result = await new TranslationService(provider, cache).translateItems(items, 'en', 'ja');
    expect(result.map((item) => item.title)).toEqual(['訳:before', 'bad', '訳:after']);
    expect(await cache.read(translationCacheKey('fake:v1', 'en', 'ja', 'bad'))).toBeUndefined();
    translateMany.mockClear();
    translateMany.mockImplementation(async (texts) => texts.map((text) => `訳:${text}`));
    const again = await new TranslationService(provider, new TranslationCache(directory)).translateItems(
      items,
      'en',
      'ja',
    );
    expect(translateMany.mock.calls.map(([texts]) => texts)).toEqual([['bad', 'summary-bad']]);
    expect(again.map((item) => item.title)).toEqual(['訳:before', '訳:bad', '訳:after']);
  });

  it('巨大な1記事を原文で残し、正常記事だけを上限内の通信量で翻訳する', async () => {
    const translateMany = vi.fn(async (texts: string[]): Promise<string[]> => texts.map((text) => `訳:${text}`));
    const service = new TranslationService(
      { id: 'fake:v1', limits: testTranslationLimits, translateMany },
      new TranslationCache(directory),
    );
    const oversized = makeSourceItem({ title: 'big', summary: 'x'.repeat(32 * 1024 * 1024) });
    const [big, healthy] = await service.translateItems([oversized, makeSourceItem()], 'en', 'ja');
    expect(big).toEqual({ ...oversized, originalTitle: 'big' });
    expect(healthy.title).toBe('訳:New API');
    expect(translateMany.mock.calls.flatMap(([texts]) => texts)).not.toContain(oversized.summary);
  });

  it('件数に加えてUTF-8とJSONエスケープ後のバイト数で分割する', async () => {
    const translateMany = vi.fn(async (texts: string[]): Promise<string[]> => texts.map((text) => `訳:${text}`));
    const limits = { ...testTranslationLimits, maxBatchTexts: 3, maxBatchBytes: 110, maxTextBytes: 45 };
    const items = ['日本語日本語', '"'.repeat(18), '\\'.repeat(18), 'a'.repeat(45)].map((title) =>
      makeSourceItem({ title, summary: '' }),
    );
    const result = await new TranslationService(
      { id: 'fake:v1', limits, translateMany },
      new TranslationCache(directory),
    ).translateItems(items, 'en', 'ja');
    expect(result.every((item) => item.title?.startsWith('訳:'))).toBe(true);
    expect(translateMany.mock.calls.length).toBeGreaterThan(1);
    for (const [texts, sourceLanguage, targetLanguage] of translateMany.mock.calls as [string[], string?, string?][]) {
      expect(texts.length).toBeLessThanOrEqual(3);
      expect(Buffer.byteLength(JSON.stringify({ sourceLanguage, targetLanguage, texts }))).toBeLessThanOrEqual(110);
    }
  });

  it('総時間の残りがバッチ期限より短ければ、成功済みキャッシュを保持して残りを原文にする', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = Date.now();
    const translateMany = vi.fn(async (texts: string[]): Promise<string[]> => {
      vi.setSystemTime(start + 16_000);
      return texts.map((text) => `訳:${text}`);
    });
    const cache = new TranslationCache(directory);
    const limits = { ...testTranslationLimits, totalTimeoutMs: 20_000, maxBatchTexts: 2 };
    const result = await new TranslationService({ id: 'fake:v1', limits, translateMany }, cache).translateItems(
      [makeSourceItem(), makeSourceItem({ title: 'later', summary: 'later-summary' })],
      'en',
      'ja',
    );
    expect(translateMany).toHaveBeenCalledTimes(1);
    expect(result.map((item) => item.title)).toEqual(['訳:New API', 'later']);
    expect(await cache.read(translationCacheKey('fake:v1', 'en', 'ja', 'New API'))).toBe('訳:New API');
  });
  it('翻訳結果の不正な制御文字を除去し、改行は空白として配信する', async () => {
    const translateMany = vi.fn(async (): Promise<string[]> => ['新しい\u0000API', 'アプリ\nを構築\u0007']);
    const cache = new TranslationCache(directory);
    const service = new TranslationService({ id: 'fake:v1', limits: testTranslationLimits, translateMany }, cache);
    const [result] = await service.translateItems([makeSourceItem()], 'en', 'ja');
    expect(result.title).toBe('新しいAPI');
    expect(result.summary).toBe('アプリ を構築');
    expect(await cache.read(translationCacheKey('fake:v1', 'en', 'ja', 'New API'))).toBe('新しいAPI');
  });
  it('タイトルと概要を一括翻訳し、原文・公開情報を維持する', async () => {
    const translateMany = vi.fn(async (): Promise<string[]> => ['新しいAPI', 'アプリを構築']);
    const service = new TranslationService(
      { id: 'fake:v1', limits: testTranslationLimits, translateMany },
      new TranslationCache(directory),
    );
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
    const provider: Translator = { id: 'fake:v1', limits: testTranslationLimits, translateMany };
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
    const service = new TranslationService(
      { id: 'fake:v1', limits: testTranslationLimits, translateMany },
      new TranslationCache(directory),
    );
    await service.translateItems([makeSourceItem()], 'en', 'ja');
    await service.translateItems([makeSourceItem({ summary: 'Updated summary' })], 'en', 'ja');
    expect(translateMany.mock.calls[1][0]).toEqual(['Updated summary']);
  });

  it.each(['other-provider:v1', 'fake:v2'])('プロバイダーまたはモデル変更では再翻訳する: %s', async (id) => {
    const translateMany = vi.fn(async (texts: string[]): Promise<string[]> => texts.map((text) => `日本語:${text}`));
    await new TranslationService(
      { id: 'fake:v1', limits: testTranslationLimits, translateMany },
      new TranslationCache(directory),
    ).translateItems([makeSourceItem()], 'en', 'ja');
    await new TranslationService(
      { id, limits: testTranslationLimits, translateMany },
      new TranslationCache(directory),
    ).translateItems([makeSourceItem()], 'en', 'ja');
    expect(translateMany).toHaveBeenCalledTimes(2);
  });

  it('contentSnippetを概要として翻訳し、空の概要を翻訳器へ渡さない', async () => {
    const translateMany = vi.fn(async (texts: string[]): Promise<string[]> => texts.map((text) => `日本語:${text}`));
    const service = new TranslationService(
      { id: 'fake:v1', limits: testTranslationLimits, translateMany },
      new TranslationCache(directory),
    );
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
    const service = new TranslationService(
      { id: 'fake:v1', limits: testTranslationLimits, translateMany },
      new TranslationCache(directory),
    );
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
    const service = new TranslationService(
      { id: 'fake:v1', limits: testTranslationLimits, translateMany },
      new TranslationCache(directory),
    );
    const item = makeSourceItem();
    expect(await service.translateItems([item], 'en', 'ja')).toEqual([{ ...item, originalTitle: item.title }]);
    translateMany.mockResolvedValue(['件数不一致']);
    expect(await service.translateItems([item], 'en', 'ja')).toEqual([{ ...item, originalTitle: item.title }]);
    expect(await fs.readdir(directory)).toEqual([]);
  });

  it('翻訳対象が空の場合は翻訳器を呼び出さない', async () => {
    const translateMany = vi.fn();
    const service = new TranslationService(
      { id: 'fake:v1', limits: testTranslationLimits, translateMany },
      new TranslationCache(directory),
    );
    expect(await service.translateItems([], 'en', 'ja')).toEqual([]);
    expect(translateMany).not.toHaveBeenCalled();
  });
});

describe('TranslationCache', () => {
  it.each([null, [], {}, { translation: 123 }, { translation: '  ' }])(
    '構文が正常でも値が不正なキャッシュを再取得する: %j',
    async (value) => {
      const key = translationCacheKey('fake:v1', 'en', 'ja', 'Title');
      await fs.writeFile(path.join(directory, `${key}.json`), JSON.stringify(value));
      const cache = new TranslationCache(directory);
      expect(await cache.read(key)).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith('[translate] cache-read-failed');
      await cache.write(key, 'タイトル');
      expect(await cache.read(key)).toBe('タイトル');
    },
  );

  it('キャッシュを書けない場合も翻訳記事を保持し、保存失敗を警告する', async () => {
    const blocked = path.join(directory, 'not-a-directory');
    await fs.writeFile(blocked, 'occupied');
    const translateMany = vi.fn(async (texts: string[]) => texts.map((text) => `訳:${text}`));
    const service = new TranslationService(
      { id: 'fake:v1', limits: testTranslationLimits, translateMany },
      new TranslationCache(blocked),
    );
    const [result] = await service.translateItems([makeSourceItem()], 'en', 'ja');
    expect(result).toMatchObject({ title: '訳:New API', summary: '訳:Build apps' });
    expect(logger.warn).toHaveBeenCalledWith('[translate] cache-write-failed');
    expect(await fs.readFile(blocked, 'utf8')).toBe('occupied');
    expect(await fs.readdir(directory)).toEqual(['not-a-directory']);
  });

  it('同じキーの同時保存は完全なJSONになり、一時ファイルを残さない', async () => {
    const cache = new TranslationCache(directory);
    const key = translationCacheKey('fake:v1', 'en', 'ja', 'Title');
    const translations = ['日本語😀'.repeat(5000), '別の訳'.repeat(5000)];
    await Promise.all(translations.map((text) => cache.write(key, text)));
    expect(translations).toContain(await cache.read(key));
    expect(await fs.readdir(directory)).toEqual([`${key}.json`]);
  });

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
