import { type Server, createServer } from 'node:http';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { Agent, fetch as undiciFetch } from 'undici';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { limitResponseSize } from '../../src/common/response-limit';

let server: Server;
let base: string;
let agent: Agent;
beforeEach(async () => {
  server = createServer((request, response) => {
    const name = request.url?.slice(1) ?? '';
    if (name.startsWith('good-')) {
      response.setHeader('content-encoding', 'gzip');
      response.end(gzipSync(Buffer.alloc(Number(name.slice(5)), 65)));
    } else if (name === 'error-gzip' || name === 'brotli') {
      response.statusCode = name === 'error-gzip' ? 503 : 200;
      response.setHeader('content-encoding', name === 'brotli' ? 'br' : 'gzip');
      response.end((name === 'brotli' ? brotliCompressSync : gzipSync)(Buffer.alloc(2048)));
    } else if (name === 'broken-gzip') {
      response.setHeader('content-encoding', 'gzip');
      response.end(Buffer.from('invalid gzip bytes'));
    } else if (name === 'truncated-gzip') {
      response.setHeader('content-encoding', 'gzip');
      response.end(gzipSync(Buffer.from('healthy text')).subarray(0, 12));
    } else if (name === 'gzip' || name === 'nested-gzip') {
      response.setHeader('content-encoding', name === 'gzip' ? 'gzip' : 'gzip, gzip');
      const body = gzipSync(Buffer.alloc(2048));
      response.end(name === 'gzip' ? body : gzipSync(body));
    } else {
      if (name === 'oversized-header') response.setHeader('content-length', '1025');
      response.write(Buffer.alloc(512));
      response.end(Buffer.alloc(513));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('テストサーバーのアドレスが不正です');
  base = `http://127.0.0.1:${address.port}`;
  agent = new Agent();
});
afterEach(async () => {
  await agent.close();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

it.each(['native', 'undici'])(
  '圧縮・Content-Length欠落でも受信上限を守り、後続取得を継続する: %s',
  async (client) => {
    const dispatcher = limitResponseSize(agent, 1024);
    const fetchBytes = async (path: string): Promise<ArrayBuffer> => {
      const options = { dispatcher, signal: AbortSignal.timeout(2000) };
      const response =
        client === 'native' ? await fetch(`${base}/${path}`, options) : await undiciFetch(`${base}/${path}`, options);
      return response.arrayBuffer();
    };
    for (const name of ['plain', 'oversized-header', 'gzip', 'nested-gzip', 'error-gzip', 'brotli']) {
      try {
        await fetchBytes(name);
        throw new Error(`上限超過が受理されました: ${name}`);
      } catch (error) {
        const cause = error instanceof Error ? error.cause : undefined;
        expect(cause ?? error, name).toHaveProperty('code', 'UND_ERR_RES_EXCEEDED_MAX_SIZE');
      }
    }
    for (const name of ['broken-gzip', 'truncated-gzip']) {
      await expect(fetchBytes(name)).rejects.toThrow();
      expect(Buffer.from(await fetchBytes('good-16'))).toEqual(Buffer.alloc(16, 65));
    }
    for (const bytes of [1023, 1024]) {
      expect(Buffer.from(await fetchBytes(`good-${bytes}`))).toEqual(Buffer.alloc(bytes, 65));
    }
  },
  15_000,
);
