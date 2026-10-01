import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../src/feed/translation/translator-factory';
import { testTranslationLimits } from '../../helpers/translation-fixtures';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe('Python設定による翻訳機の選択', () => {
  it('中国語には英語と異なる経路の識別子を使う', () => {
    vi.mocked(execFileSync).mockReturnValue(
      JSON.stringify({ configured: true, providerIds: { en: 'direct', zh: 'pivot' }, limits: testTranslationLimits }),
    );
    expect(createTranslator('zh').id).toBe('pivot');
  });
  it.each(['argos:model-v1', 'bedrock:model-v2', 'amazon-translate:v1'])(
    'Pythonが返す%sの識別子をキャッシュに使う',
    (providerId) => {
      vi.mocked(execFileSync).mockReturnValue(
        JSON.stringify({
          configured: true,
          providerIds: { en: providerId, zh: 'argos:zh' },
          limits: testTranslationLimits,
        }),
      );
      expect(createTranslator().id).toBe(providerId);
      expect(execFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.venv'),
        ['scripts/translation/provider_factory.py'],
        expect.objectContaining({ timeout: 10_000, maxBuffer: 64 * 1024 }),
      );
    },
  );
  it.each([
    { configured: false, providerId: 'bedrock:v1', limits: testTranslationLimits },
    { configured: true, providerIds: { en: '' }, limits: testTranslationLimits },
    { configured: true, providerIds: { en: 'argos:v1' }, limits: { ...testTranslationLimits, batchTimeoutMs: 0 } },
    { configured: true, providerIds: { en: 'argos:v1' }, limits: { ...testTranslationLimits, maxTextBytes: '1000' } },
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
