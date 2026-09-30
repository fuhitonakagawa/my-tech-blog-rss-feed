import type EleventyImage from '@11ty/eleventy-img';
import constants from './constants.js';
import { publicNetworkDispatcher } from './url-guard';

export const imageCacheOptions: EleventyImage.CacheOptions = {
  duration: '3d',
  type: 'buffer',
  fetchOptions: {
    headers: {
      'User-Agent': constants.requestUserAgent,
    },
    dispatcher: publicNetworkDispatcher,
    // 待機キューや別の画像取得と期限を共有しない。
    get signal(): AbortSignal {
      return AbortSignal.timeout(constants.externalFetchTimeoutMs);
    },
  },
};
