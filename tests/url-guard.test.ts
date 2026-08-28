import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  isPublicIpAddress,
  isValidHttpUrl,
  isValidImageDataUrl,
  publicNetworkDispatcher,
  sanitizeHttpUrl,
} from '../src/common/url-guard';

describe('isValidHttpUrl', () => {
  it('http / https のURLを許可する', () => {
    expect(isValidHttpUrl('http://example.com/feed')).toBe(true);
    expect(isValidHttpUrl('https://example.com/feed')).toBe(true);
  });

  it('スクリプトを実行できるスキームを拒否する', () => {
    expect(isValidHttpUrl('javascript:alert(document.domain)')).toBe(false);
    expect(isValidHttpUrl('JavaScript:alert(1)')).toBe(false);
    expect(isValidHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isValidHttpUrl('vbscript:msgbox(1)')).toBe(false);
  });

  it('URLとして解釈できない文字列を拒否する', () => {
    expect(isValidHttpUrl('')).toBe(false);
    expect(isValidHttpUrl('/relative/path')).toBe(false);
  });
});

describe('sanitizeHttpUrl', () => {
  it('http / https のURLはそのまま返す', () => {
    expect(sanitizeHttpUrl('https://example.com/article')).toBe('https://example.com/article');
  });

  it('スクリプトを実行できるスキームは空文字にする', () => {
    expect(sanitizeHttpUrl('javascript:alert(document.domain)')).toBe('');
  });

  it('未設定の値は空文字にする', () => {
    expect(sanitizeHttpUrl(undefined)).toBe('');
    expect(sanitizeHttpUrl(null)).toBe('');
  });
});

describe('isValidImageDataUrl', () => {
  it('画像のデータURLを許可する', () => {
    expect(isValidImageDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isValidImageDataUrl('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(true);
  });

  it('画像以外のデータURLを拒否する', () => {
    expect(isValidImageDataUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isValidImageDataUrl('https://example.com/icon.png')).toBe(false);
  });
});

describe('isPublicIpAddress', () => {
  it('公開インターネット上のアドレスを許可する', () => {
    expect(isPublicIpAddress('8.8.8.8')).toBe(true);
    expect(isPublicIpAddress('2606:4700:4700::1111')).toBe(true);
    expect(isPublicIpAddress('::ffff:8.8.8.8')).toBe(true);
  });

  it('ループバック・プライベート・リンクローカルのアドレスを拒否する', () => {
    expect(isPublicIpAddress('127.0.0.1')).toBe(false);
    expect(isPublicIpAddress('10.0.0.1')).toBe(false);
    expect(isPublicIpAddress('172.16.0.1')).toBe(false);
    expect(isPublicIpAddress('192.168.0.1')).toBe(false);
    expect(isPublicIpAddress('169.254.169.254')).toBe(false);
    expect(isPublicIpAddress('::1')).toBe(false);
    expect(isPublicIpAddress('fd00::1')).toBe(false);
    expect(isPublicIpAddress('fe80::1')).toBe(false);
  });

  it('IPv4射影アドレスでもIPv4の範囲で判定する', () => {
    expect(isPublicIpAddress('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicIpAddress('::ffff:169.254.169.254')).toBe(false);
  });

  it('IPアドレスとして解釈できない文字列を拒否する', () => {
    expect(isPublicIpAddress('example.com')).toBe(false);
    expect(isPublicIpAddress('')).toBe(false);
  });
});

describe('publicNetworkDispatcher', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><head><title>internal</title></head><body>internal</body></html>');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('IPアドレス直書きのループバックへの接続を拒否する', async () => {
    await expect(fetch(`http://127.0.0.1:${port}/`, { dispatcher: publicNetworkDispatcher })).rejects.toThrow();
  });

  it('名前解決の結果がループバックになるホストへの接続を拒否する', async () => {
    await expect(fetch(`http://localhost:${port}/`, { dispatcher: publicNetworkDispatcher })).rejects.toThrow();
  });

  it('dispatcher を指定しない場合と異なり、ガード対象の接続だけを止める', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/`);

    expect(response.status).toBe(200);
  });
});
