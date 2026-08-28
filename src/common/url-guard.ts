/**
 * 外部フィード由来のURLを扱うためのガード。
 *
 * - HTMLの `href` や取得対象として扱ってよいスキームを http / https に限定する
 * - 接続直前のアドレスを検査し、ループバック・プライベート・リンクローカルなど
 *   公開インターネット上にないホストへの接続を拒否する（SSRF対策）
 */

import { type LookupAllOptions, lookup as dnsLookup } from 'node:dns';
import { BlockList, type LookupFunction, isIP } from 'node:net';
import { Agent, buildConnector } from 'undici';

/** 取得・リンクを許可するURLスキーム */
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * 公開インターネット上のホストとみなさないIPv4アドレス範囲。
 * プライベート・ループバック・リンクローカル・共有アドレス空間・文書用・マルチキャスト・予約領域
 */
const NON_PUBLIC_IPV4_SUBNETS: [address: string, prefix: number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

/**
 * 公開インターネット上のホストとみなさないIPv6アドレス範囲。
 * IPv4射影アドレス（`::ffff:0:0/96`）は BlockList がIPv4の範囲として判定するため列挙しない
 */
const NON_PUBLIC_IPV6_SUBNETS: [address: string, prefix: number][] = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

const nonPublicAddressBlockList = new BlockList();
for (const [address, prefix] of NON_PUBLIC_IPV4_SUBNETS) {
  nonPublicAddressBlockList.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of NON_PUBLIC_IPV6_SUBNETS) {
  nonPublicAddressBlockList.addSubnet(address, prefix, 'ipv6');
}

/**
 * URLのスキームが http / https かを判定する。
 * URLとして解釈できない文字列は false を返す
 */
export const isValidHttpUrl = (url: string): boolean => {
  let urlObject: URL;

  try {
    urlObject = new URL(url);
  } catch {
    return false;
  }

  return ALLOWED_URL_PROTOCOLS.has(urlObject.protocol);
};

/**
 * HTMLの `href` / `src` に出力してよいURLを返す。
 * `javascript:` などの実行可能なスキームは空文字にして無害化する
 */
export const sanitizeHttpUrl = (url: string | null | undefined): string => {
  if (!url || !isValidHttpUrl(url)) {
    return '';
  }

  return url;
};

/**
 * 画像として埋め込んでよいデータURLかを判定する。
 * `data:text/html` などスクリプトを持ち込めるメディアタイプを除外する
 */
export const isValidImageDataUrl = (url: string): boolean => {
  return /^data:image\/[a-z0-9.+-]+[;,]/i.test(url);
};

/**
 * IPアドレスが公開インターネット上のものかを判定する。
 * IPアドレスとして解釈できない文字列は false を返す
 */
export const isPublicIpAddress = (address: string): boolean => {
  const family = isIP(address);

  if (family === 0) {
    return false;
  }

  return !nonPublicAddressBlockList.check(address, family === 4 ? 'ipv4' : 'ipv6');
};

/**
 * URLのホスト名表記からIPv6アドレスのブラケットを取り除く
 */
const stripIpv6Brackets = (hostname: string): string => {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
};

const createNonPublicAddressError = (hostname: string, address: string): Error => {
  return new Error(
    `公開インターネット上にないアドレスへの接続を拒否しました。 hostname: ${hostname}, address: ${address}`,
  );
};

/**
 * 名前解決の結果に非公開アドレスが含まれていれば接続前にエラーにする。
 * 接続には解決済みのアドレスがそのまま使われるため、DNSリバインディングも防げる
 */
const publicAddressLookup: LookupFunction = (hostname, options, callback) => {
  const lookupAllOptions: LookupAllOptions = { ...options, all: true };

  dnsLookup(hostname, lookupAllOptions, (error, addresses) => {
    if (error) {
      callback(error, '', 0);
      return;
    }

    const nonPublicAddress = addresses.find(({ address }) => !isPublicIpAddress(address));
    if (nonPublicAddress) {
      callback(createNonPublicAddressError(hostname, nonPublicAddress.address), '', 0);
      return;
    }

    if (options.all) {
      callback(null, addresses);
      return;
    }

    const [{ address, family }] = addresses;
    callback(null, address, family);
  });
};

const baseConnector = buildConnector({ lookup: publicAddressLookup });

/**
 * ホスト名がIPアドレス直書きのときは名前解決が行われないため、接続前にここで検査する
 */
const publicAddressConnector: buildConnector.connector = (options, callback) => {
  const hostname = stripIpv6Brackets(options.hostname);

  if (isIP(hostname) !== 0 && !isPublicIpAddress(hostname)) {
    callback(createNonPublicAddressError(options.hostname, hostname), null);
    return;
  }

  baseConnector({ ...options, hostname }, callback);
};

/**
 * 公開インターネット上のホストへの接続だけを許可する undici Dispatcher。
 * `fetch` の `dispatcher` に渡すと、リダイレクト先も含めて接続ごとに検査される
 */
export const publicNetworkDispatcher = new Agent({ connect: publicAddressConnector });
