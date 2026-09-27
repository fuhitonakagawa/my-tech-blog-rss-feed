import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PythonTranslator } from './python-translator';
import type { Translator } from './translator';

const PROJECT_DIRECTORY = fileURLToPath(new URL('../../../', import.meta.url));

/** Pythonの管理対象設定から翻訳機とキャッシュ識別子を取得する */
export const createTranslator = (): Translator => {
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
    !('providerId' in descriptor) ||
    typeof descriptor.providerId !== 'string' ||
    !descriptor.providerId ||
    !('timeoutMs' in descriptor) ||
    typeof descriptor.timeoutMs !== 'number' ||
    !Number.isSafeInteger(descriptor.timeoutMs) ||
    descriptor.timeoutMs <= 0
  ) {
    throw new Error('翻訳設定が不足しているか不正です');
  }
  return new PythonTranslator({
    projectDirectory: PROJECT_DIRECTORY,
    timeoutMs: descriptor.timeoutMs,
    providerId: descriptor.providerId,
  });
};
