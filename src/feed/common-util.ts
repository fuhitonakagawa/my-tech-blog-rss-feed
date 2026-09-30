import * as crypto from 'node:crypto';
import { to } from 'await-to-js';
import axios from 'axios';

type HatenaCountMap = Record<string, number>;

export const objectDeepCopy = <T>(data: T): T => {
  return structuredClone(data);
};

export const textToMd5Hash = (text: string): string => {
  const md5 = crypto.createHash('md5');
  return md5.update(text, 'binary').digest('hex');
};

export const textTruncate = (text: string, maxLength: number): string => {
  return Array.from(text).slice(0, maxLength).join('');
};

const TRACKING_QUERY_PARAMETER_NAMES = new Set([
  '_hsenc',
  '_hsmi',
  'dclid',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'msclkid',
]);

/** Google Cloudのリリースノートで日別記事を識別するアンカーか判定する。 */
const isReleaseNoteDateFragment = (url: URL): boolean => {
  if (!['cloud.google.com', 'docs.cloud.google.com'].includes(url.hostname)) return false;
  if (!/\/release-notes\/?$/.test(url.pathname)) return false;
  return /^#(?:January|February|March|April|May|June|July|August|September|October|November|December)_\d{1,2}_\d{4}$/.test(
    url.hash,
  );
};

/** 日別記事のアンカーを保持し、追跡情報と通常の見出しアンカーを取り除く。 */
export const normalizeArticleUrl = (url: string): string => {
  let urlObject: URL;
  try {
    urlObject = new URL(url);
  } catch {
    return url;
  }

  let changed = urlObject.hash !== '' && !isReleaseNoteDateFragment(urlObject);
  if (changed) urlObject.hash = '';
  for (const parameterName of [...urlObject.searchParams.keys()]) {
    const normalizedName = parameterName.toLowerCase();
    if (normalizedName.startsWith('utm_') || TRACKING_QUERY_PARAMETER_NAMES.has(normalizedName)) {
      urlObject.searchParams.delete(parameterName);
      changed = true;
    }
  }

  return changed ? urlObject.toString() : url;
};

/** XML禁止文字と表示用制御文字を除き、正常な補助平面文字は保持する。 */
export const removeInvalidUnicode = (text: string): string => {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: XML禁止文字と表示用制御文字を除く
  return text.replace(/[\x00-\x1F\x7F-\x9F\uD800-\uDFFF\uFFFE\uFFFF]/gu, '');
};

/** XMLの改行・タブを保持し、表示や識別に使えない制御文字を検出する。 */
export const hasInvalidControlCharacters = (text: string): boolean =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: XMLで許容する空白以外の制御文字を検出する
  /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F\uD800-\uDFFF\uFFFE\uFFFF]/u.test(text);

export const exponentialBackoff = async <A>(
  retrier: (attemptCount: number) => Promise<A>,
  baseWaitMs = 1000,
  retries = 3,
) => {
  let attemptLimitReached = false;
  let attemptCount = 0;

  // 引数ミス防止
  if (retries > 10) {
    throw new Error('retries が 10 を超えています');
  }

  while (!attemptLimitReached) {
    const [error, result] = await to(retrier(attemptCount));
    if (error) {
      attemptCount++;
      attemptLimitReached = attemptCount > retries;

      if (attemptLimitReached) {
        throw error;
      }
      const waitTime = 2 ** attemptCount * baseWaitMs;
      await sleep(waitTime);
    } else {
      return result;
    }
  }

  throw new Error('Something went wrong.');
};

export const fetchHatenaCountMap = async (urls: string[]): Promise<HatenaCountMap> => {
  const params = new URLSearchParams(urls.map((url) => ['url', url]));
  const response = await axios.get<HatenaCountMap>(`https://bookmark.hatenaapis.com/count/entries?${params}`, {
    timeout: 1000 * 10,
  });
  return response.data;
};

export const sleep = (waitTime: number) => {
  return new Promise((resolve) => {
    return setTimeout(resolve, waitTime);
  });
};
