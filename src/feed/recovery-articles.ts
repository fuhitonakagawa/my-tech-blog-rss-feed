import * as fs from 'node:fs';
import { isPublishableHttpUrl } from '../common/url-guard';
import { type AcquiredArticle, isAcquiredArticle } from './acquisition-history';

interface RecoveryArticle extends AcquiredArticle {
  sourceUrls: string[];
}

/** 確認済みの取得元・記事日時を持つ補完データだけを通常の取得処理へ渡す。 */
const parseRecoveryArticles = (value: unknown): RecoveryArticle[] => {
  if (!Array.isArray(value)) throw new Error('記事補完データは配列で指定してください');
  for (const item of value) {
    if (
      !isAcquiredArticle(item) ||
      !('sourceUrls' in item) ||
      !Array.isArray(item.sourceUrls) ||
      !item.sourceUrls.length ||
      !item.sourceUrls.every((url: unknown) => typeof url === 'string' && isPublishableHttpUrl(url))
    )
      throw new Error('記事補完データの取得元・記事URL・公開日時が不正です');
  }
  return value as RecoveryArticle[];
};

export const RECOVERY_ARTICLES = parseRecoveryArticles(
  JSON.parse(fs.readFileSync(new URL('../resources/feed-recovery.json', import.meta.url), 'utf8')),
);

export const recoveryArticles = (sourceUrl: string): AcquiredArticle[] =>
  RECOVERY_ARTICLES.filter((item) => item.sourceUrls.includes(sourceUrl)).map(
    ({ sourceUrls: _sources, ...item }) => item,
  );
