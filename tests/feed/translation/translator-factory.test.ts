import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../src/feed/translation/translator-factory';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe('Python設定による翻訳機の選択', () => {
  it.each(['argos:model-v1', 'bedrock:model-v2', 'amazon-translate:v1'])(
    'Pythonが返す%sの識別子をキャッシュに使う',
    (providerId) => {
      vi.mocked(execFileSync).mockReturnValue(JSON.stringify({ configured: true, providerId, timeoutMs: 1000 }));
      expect(createTranslator().id).toBe(providerId);
      expect(execFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.venv'),
        ['scripts/translation/provider_factory.py'],
        expect.objectContaining({ timeout: 10_000, maxBuffer: 64 * 1024 }),
      );
    },
  );
  it.each([
    { configured: false, providerId: 'bedrock:v1', timeoutMs: 1000 },
    { configured: true, providerId: '', timeoutMs: 1000 },
    { configured: true, providerId: 'argos:v1', timeoutMs: 0 },
    { configured: true, providerId: 'argos:v1', timeoutMs: '1000' },
    null,
  ])('未設定・不正な応答から翻訳機を作らない', (response) => {
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify(response));
    expect(() => createTranslator()).toThrow('翻訳設定');
  });
  it('Python設定を取得できない場合は呼び出し元へ失敗を通知する', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('Python unavailable');
    });
    expect(() => createTranslator()).toThrow('Python unavailable');
  });
});
