import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArgosTranslator } from './argos-translator';
import type { Translator } from './translator';

const PROJECT_DIRECTORY = fileURLToPath(new URL('../../../', import.meta.url));

/** 環境設定と固定モデル情報から翻訳プロバイダーを作る */
export const createTranslator = (): Translator => {
  const envPath = path.join(PROJECT_DIRECTORY, '.env');
  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
  if (process.env.TRANSLATION_PROVIDER !== 'argos') {
    throw new Error('TRANSLATION_PROVIDERにはargosの指定が必要です');
  }
  const timeoutMs = Number(process.env.TRANSLATION_TIMEOUT_MS);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('TRANSLATION_TIMEOUT_MSには正の整数が必要です');
  }
  const model: unknown = JSON.parse(
    fs.readFileSync(path.join(PROJECT_DIRECTORY, 'scripts/translation/model.json'), 'utf-8'),
  );
  if (
    model === null ||
    typeof model !== 'object' ||
    !('argosVersion' in model) ||
    typeof model.argosVersion !== 'string' ||
    !('packageVersion' in model) ||
    typeof model.packageVersion !== 'string' ||
    !('sha256' in model) ||
    typeof model.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(model.sha256)
  ) {
    throw new Error('Argosのモデル定義が不正です');
  }
  return new ArgosTranslator({
    projectDirectory: PROJECT_DIRECTORY,
    timeoutMs,
    providerId: `argos:${model.argosVersion}:en-ja:${model.packageVersion}:${model.sha256}:${createHash('sha256')
      .update(fs.readFileSync(path.join(PROJECT_DIRECTORY, 'uv.lock')))
      .digest('hex')}`,
  });
};
