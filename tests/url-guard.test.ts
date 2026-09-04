import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  isPublicIpAddress,
  isPublishableHttpUrl,
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

describe('isPublishableHttpUrl', () => {
  it.each([
    ['クエリなし', 'https://example.com/image.png'],
    ['通常の画像変換クエリ', 'https://example.com/image.png?width=1200&format=webp'],
    ['認証語を値にだけ含むクエリ', 'https://example.com/image.png?description=token'],
    ['拒否対象と似た名前のクエリ', 'https://example.com/image.png?signatureVersion=4&x-amazing=true'],
    ['通常のフラグメント', 'https://example.com/image.svg#thumbnail'],
  ])('%sを持つURLを許可する', (_caseName, url) => {
    expect(isPublishableHttpUrl(url)).toBe(true);
  });

  it.each([
    'https://user@example.com/image.png',
    'https://user:password@example.com/image.png',
    'https://:password@example.com/image.png',
  ])('ユーザー情報を含むURLを拒否する: %s', (url) => {
    expect(isPublishableHttpUrl(url)).toBe(false);
  });

  it.each([
    '__token__',
    'access_token',
    'api-key',
    'api_key',
    'apikey',
    'auth',
    'auth_key',
    'auth_token',
    'authorization',
    'credential',
    'GoogleAccessId',
    'hdntl',
    'hdnts',
    'jwt',
    'Key-Pair-Id',
    'password',
    'passwd',
    'secret',
    'sig',
    'Signature',
    'token',
  ])('認証・署名用クエリパラメーター %s を拒否する', (parameterName) => {
    expect(isPublishableHttpUrl(`https://example.com/image.png?${parameterName}=example`)).toBe(false);
  });

  it.each([
    [
      'AWS',
      'https://example.com/image.png?response-content-type=image%2Fjpeg&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=example&X-Amz-Signature=example',
    ],
    ['Google Cloud', 'https://example.com/image.png?X-Goog-Algorithm=GOOG4-RSA-SHA256'],
    ['Azure SAS', 'https://example.com/image.png?sv=example&sp=r&sig=example'],
    ['CloudFront', 'https://example.com/image.png?Expires=1&Signature=example&Key-Pair-Id=example'],
    ['Akamai', 'https://example.com/image.png?hdnts=example'],
  ])('%sの署名付きURLを拒否する', (_providerName, url) => {
    expect(isPublishableHttpUrl(url)).toBe(false);
  });

  it.each([
    'https://example.com/image.png?ACCESS_TOKEN=example',
    'https://example.com/image.png?X%2DAmz%2DCredential=example',
  ])('大文字小文字とURLエンコードを正規化して拒否する: %s', (url) => {
    expect(isPublishableHttpUrl(url)).toBe(false);
  });

  it.each([
    'https://example.com/image.png#access_token=example',
    'https://example.com/image.png#?X-Goog-Signature=example',
  ])('フラグメントに認証・署名情報を含むURLを拒否する: %s', (url) => {
    expect(isPublishableHttpUrl(url)).toBe(false);
  });

  it.each(['data:image/png;base64,iVBORw0KGgo=', '/image.png', '', 'not-a-url'])(
    'http / https 以外と不正なURLを拒否する: %s',
    (url) => {
      expect(isPublishableHttpUrl(url)).toBe(false);
    },
  );
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
