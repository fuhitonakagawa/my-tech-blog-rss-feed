import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

describe('Argosのローカル翻訳', () => {
  it('モデル導入後は外部通信なしで翻訳できる', async () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const program = `
import json
import socket
import sys
sys.path.insert(0, 'scripts/translation')
from runtime import configure_environment, configure_logging, load_model_definition
from argos_provider import load_translation
configure_logging()
configure_environment()
network_attempts: list[None] = []
def deny_network(*args: object, **kwargs: object) -> None:
    network_attempts.append(None)
    raise AssertionError('外部接続は禁止されています')
socket.socket.connect = deny_network
socket.socket.connect_ex = deny_network
socket.getaddrinfo = deny_network
translated = load_translation(load_model_definition()).translate('Introducing a new API for developers')
print(json.dumps({'translated': translated, 'networkAttempts': len(network_attempts)}, ensure_ascii=False))
`;
    const { stdout } = await promisify(execFile)(python, ['-c', program], { cwd: root, timeout: 60_000 });
    const response = JSON.parse(stdout) as { translated: string; networkAttempts: number };
    expect(response.translated).toMatch(/[ぁ-んァ-ヶ一-龯]/);
    expect(response.networkAttempts).toBe(0);
  });
  it('英日モデルで複数テキストを翻訳し有効なJSON応答を返す', async () => {
    const source = ['Introducing a new API for developers', 'Build secure applications with AWS and Kubernetes.'];
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const program = `
import io
import json
import sys
from dataclasses import replace
sys.path.insert(0, 'scripts/translation')
import config
config.CONFIG = replace(config.CONFIG, provider='argos')
from translate import main
request = {'sourceLanguage': 'en', 'targetLanguage': 'ja', 'texts': json.loads(sys.argv[1])}
sys.stdin = io.TextIOWrapper(io.BytesIO(json.dumps(request).encode()))
raise SystemExit(main())
`;
    const { stdout } = await promisify(execFile)(python, ['-c', program, JSON.stringify(source)], {
      cwd: root,
      timeout: 60_000,
    });
    const response = JSON.parse(stdout) as { providerId: string; translations: string[] };
    expect(response.providerId).toMatch(/^argos:/);
    const result = response.translations;
    expect(result).toHaveLength(source.length);
    for (const [index, translation] of result.entries()) {
      expect(translation.trim()).not.toBe('');
      expect(translation).not.toBe(source[index]);
      expect(translation).toMatch(/[ぁ-んァ-ヶ一-龯]/);
    }
  });
});
