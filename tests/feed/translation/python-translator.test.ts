import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PythonTranslator } from '../../../src/feed/translation/python-translator';

let directory: string;
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'argos-protocol-'));
  await fs.mkdir(path.join(directory, '.venv/bin'), { recursive: true });
});
afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

/** 子プロセス境界のJSON応答を再現するテスト用実行ファイルを作る */
const provider = async (body: string, timeoutMs = 5000): Promise<PythonTranslator> => {
  await fs.writeFile(path.join(directory, '.venv/bin/python'), `#!/usr/bin/env node\n${body}`, { mode: 0o755 });
  return new PythonTranslator({ projectDirectory: directory, providerId: 'test:v1', timeoutMs });
};

describe('PythonTranslatorのプロセス境界', () => {
  it('一括入力をstdinへ送り、stdoutの入力順の結果を返す', async () => {
    const translator = await provider(`
      let input = '';
      process.stdin.on('data', chunk => { input += chunk; });
      process.stdin.on('end', () => {
        const request = JSON.parse(input);
        process.stdout.write(JSON.stringify({providerId: 'test:v1', translations: request.texts.map(text => '訳:' + text)}));
      });
    `);
    expect(await translator.translateMany(['one', 'two'], 'en', 'ja')).toEqual(['訳:one', '訳:two']);
  });

  it.each([
    'process.stdout.write("not JSON");',
    'process.stdout.write(JSON.stringify({providerId:"wrong",translations:["訳"]}));',
    'process.stdout.write(JSON.stringify({providerId:"test:v1",translations:[]}));',
    'process.stdout.write(JSON.stringify({providerId:"test:v1",translations:[null]}));',
    'process.exit(1);',
  ])('異常な応答と終了を拒否する', async (body) => {
    const translator = await provider(body);
    await expect(translator.translateMany(['one'], 'en', 'ja')).rejects.toThrow();
  });

  it('応答しないプロセスを制限時間で終了する', async () => {
    const translator = await provider('setInterval(() => {}, 1000);', 100);
    await expect(translator.translateMany(['one'], 'en', 'ja')).rejects.toThrow('タイムアウト');
  });

  it('Pythonが存在しない場合も失敗を通知する', async () => {
    const translator = new PythonTranslator({ projectDirectory: directory, providerId: 'test:v1', timeoutMs: 1000 });
    await expect(translator.translateMany(['one'], 'en', 'ja')).rejects.toThrow();
  });
});
