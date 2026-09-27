import { spawn } from 'node:child_process';
import * as path from 'node:path';
import type { Translator } from './translator';

const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

export interface PythonTranslatorOptions {
  providerId: string;
  projectDirectory: string;
  timeoutMs: number;
}

/** 1バッチをPythonの翻訳機へ渡すプロバイダー */
export class PythonTranslator implements Translator {
  public readonly id: string;

  constructor(private readonly options: PythonTranslatorOptions) {
    this.id = options.providerId;
  }

  public async translateMany(texts: string[], sourceLanguage: string, targetLanguage: string): Promise<string[]> {
    if (texts.length === 0) {
      return [];
    }
    const executable = path.join(
      this.options.projectDirectory,
      '.venv',
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
    );
    const script = path.join(this.options.projectDirectory, 'scripts/translation/translate.py');
    return new Promise((resolve, reject) => {
      const child = spawn(executable, [script], {
        cwd: this.options.projectDirectory,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const chunks: Buffer[] = [];
      let outputBytes = 0;
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('翻訳がタイムアウトしました'));
      }, this.options.timeoutMs);
      child.stdout.on('data', (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes > MAX_OUTPUT_BYTES) {
          child.kill('SIGKILL');
          reject(new Error('翻訳の出力が上限を超えています'));
        } else {
          chunks.push(chunk);
        }
      });
      // ブリッジの標準エラーには記事本文を含めず、診断用JSONを出力する。
      child.stderr.pipe(process.stderr, { end: false });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.stdin.on('error', () => {
        child.kill('SIGKILL');
        clearTimeout(timer);
        reject(new Error('Pythonへ翻訳リクエストを送信できません'));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error('翻訳のPythonブリッジが失敗しました'));
          return;
        }
        try {
          const response: unknown = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          if (
            response === null ||
            typeof response !== 'object' ||
            !('providerId' in response) ||
            response.providerId !== this.id ||
            !('translations' in response) ||
            !Array.isArray(response.translations) ||
            response.translations.length !== texts.length ||
            response.translations.some((text: unknown) => typeof text !== 'string')
          ) {
            throw new Error('翻訳のレスポンスが不正です');
          }
          resolve(response.translations);
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.end(JSON.stringify({ sourceLanguage, targetLanguage, texts }));
    });
  }
}
