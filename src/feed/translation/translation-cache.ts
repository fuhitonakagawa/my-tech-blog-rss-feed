import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { logger } from '../logger';

/** プロバイダー・モデル・翻訳方向・原文からキャッシュの識別子を返す */
export const translationCacheKey = (providerId: string, source: string, target: string, text: string): string => {
  return createHash('sha256')
    .update(JSON.stringify([providerId, source, target, text]))
    .digest('hex');
};

/** テキスト単位の翻訳結果。読み書きの失敗は翻訳処理を止めない */
export class TranslationCache {
  constructor(private readonly directory: string) {}

  public async read(key: string): Promise<string | undefined> {
    const file = this.filePath(key);
    try {
      const value: unknown = JSON.parse(await fs.readFile(file, 'utf-8'));
      if (
        value !== null &&
        typeof value === 'object' &&
        'translation' in value &&
        typeof value.translation === 'string' &&
        value.translation.trim() !== ''
      ) {
        return value.translation;
      }
      throw new Error('翻訳キャッシュの形式が不正です');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('[translate] cache-read-failed');
      }
      return undefined;
    }
  }

  public async write(key: string, translation: string): Promise<void> {
    const file = this.filePath(key);
    if (translation.trim() === '') {
      return;
    }
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.mkdir(this.directory, { recursive: true });
      await fs.writeFile(temporary, JSON.stringify({ translation }), 'utf-8');
      await fs.rename(temporary, file);
    } catch {
      logger.warn('[translate] cache-write-failed');
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  /** ハッシュだけをファイル名として受け付ける */
  private filePath(key: string): string {
    if (!/^[a-f0-9]{64}$/.test(key)) {
      throw new Error('翻訳キャッシュのキーが不正です');
    }
    return path.join(this.directory, `${key}.json`);
  }
}
