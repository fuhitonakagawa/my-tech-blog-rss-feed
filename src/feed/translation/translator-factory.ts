import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PythonTranslator } from './python-translator';
import type { TranslationLimits, Translator } from './translator';

const PROJECT_DIRECTORY = fileURLToPath(new URL('../../../', import.meta.url));

/** バッチ制限を欠落・非整数・プロトコル上限超過なく読み込む。 */
const parseLimits = (value: unknown): TranslationLimits => {
  if (!value || typeof value !== 'object') throw new Error('翻訳設定の実行上限が不正です');
  const fields = value as Record<string, unknown>;
  const limits = {} as TranslationLimits;
  for (const key of ['totalTimeoutMs', 'batchTimeoutMs', 'maxBatchTexts', 'maxBatchBytes', 'maxTextBytes'] as const) {
    const number = fields[key];
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number <= 0)
      throw new Error('翻訳設定の実行上限が不正です');
    limits[key] = number;
  }
  if (
    limits.batchTimeoutMs > limits.totalTimeoutMs ||
    limits.maxTextBytes > limits.maxBatchBytes ||
    limits.maxBatchBytes > 32 * 1024 * 1024
  )
    throw new Error('翻訳設定のバッチ上限が不正です');
  return limits;
};

/** Pythonの管理対象設定から翻訳機とキャッシュ識別子を取得する */
export const createTranslator = (sourceLanguage: 'en' | 'zh' = 'en'): Translator => {
  const executable = path.join(
    PROJECT_DIRECTORY,
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  const descriptor: unknown = JSON.parse(
    execFileSync(executable, ['scripts/translation/provider_factory.py'], {
      cwd: PROJECT_DIRECTORY,
      timeout: 10_000,
      maxBuffer: 64 * 1024,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
  if (
    descriptor === null ||
    typeof descriptor !== 'object' ||
    !('configured' in descriptor) ||
    descriptor.configured !== true ||
    !('providerIds' in descriptor) ||
    !descriptor.providerIds ||
    typeof descriptor.providerIds !== 'object' ||
    !(sourceLanguage in descriptor.providerIds) ||
    !('limits' in descriptor)
  ) {
    throw new Error('翻訳設定が不足しているか不正です');
  }
  const providerId = (descriptor.providerIds as Record<string, unknown>)[sourceLanguage];
  if (typeof providerId !== 'string' || !providerId) throw new Error('翻訳設定の識別子が不正です');
  return new PythonTranslator({
    projectDirectory: PROJECT_DIRECTORY,
    limits: parseLimits(descriptor.limits),
    providerId,
  });
};
