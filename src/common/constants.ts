import { sectionPathId } from '../resources/section-paths';

const siteUrlStem = 'https://fuhitonakagawa.github.io/my-tech-blog-rss-feed';
const siteUrl = `${siteUrlStem}/`;

// セクションページ・フィードを配置するパスのプレフィックス。/rss/<セクションID>/ の形になる
const sectionRootPath = 'rss';
const generatedFeedRootPath = 'feeds/generated';

export default {
  // サイト設定
  siteUrl: `${siteUrl}`,
  siteUrlStem: siteUrlStem,
  siteTitle: 'my-tech-blog-rss',
  siteDescription:
    '企業のテックブログの更新をまとめたRSSフィードを配信しています。記事を読んでその企業の技術・カルチャーを知れることや、質の高い技術情報を得られることを目的としています。',

  // フィード設定
  feedTitle: '企業テックブログRSS',
  feedDescription: '企業のテックブログの更新をまとめたRSSフィード',
  feedLanguage: 'ja',
  feedCopyright: 'fuhitonakagawa/my-tech-blog-rss-feed',
  feedGenerator: 'fuhitonakagawa/my-tech-blog-rss-feed',
  feedUrls: {
    atom: `${siteUrl}feeds/atom.xml`,
    rss: `${siteUrl}feeds/rss.xml`,
    json: `${siteUrl}feeds/feed.json`,
  },

  // リンク
  author: 'fuhitonakagawa',
  gitHubUserUrl: 'https://github.com/fuhitonakagawa/',
  gitHubRepositoryUrl: 'https://github.com/fuhitonakagawa/my-tech-blog-rss-feed/',

  // Google Analytics系。フォークして使う際は値を空にするか書き換えてください
  googleSiteVerification: '',
  globalSiteTagKey: '',

  // フィードの取得などに使う UserAgent
  requestUserAgent: 'my-tech-blog-rss-feed/1.0 (+https://github.com/fuhitonakagawa/my-tech-blog-rss-feed)',
  externalFetchTimeoutMs: 10_000,
  externalFetchMaxResponseBytes: 10 * 1024 * 1024,

  // セクションのURLプレフィックス
  sectionRootPath: sectionRootPath,

  // 処理の設定
  feedFetchConcurrency: 50, // フィードを取得する並列数
  feedOgFetchConcurrency: 20, // OG情報を取得する並列数
  hatenaCountFetchConcurrency: 5, // はてなブックマーク数を取得する並列数（50件ずつのチャンク単位）
  aggregateFeedDurationInHours: 8 * 24, // まとめフィードの対象となる時間の範囲
  maxFeedDescriptionLength: 200, // フィードのdescriptionの最大文字数
  maxFeedContentLength: 500, // フィードのcontentの最大文字数
  processImageConcurrency: 50, // 画像の処理の並列数。画像取得と変換
  eleventyFetchConcurrency: 50, // Eleventyの画像取得の並列数
  fetchedFeedCacheDurationInMinutes: 15, // 毎時巡回で再取得でき、短時間の再実行では共有できる有効時間
  fetchedOgCacheDurationInHours: 24, // OG情報のキャッシュの有効時間
  cachePruneThresholdInDays: 14, // キャッシュ削除の閾値。フィードは15分、OGPは記事が集計対象期間(8日間)に入っている間24時間おき、
  // eleventy-fetchのバッファは3日おきに更新されるため、14日以上古いファイルは実質使われていないとみなせる
  feedFetchRetryCount: 1, // フィード取得のリトライ回数。ワークフローは1時間おきに動くので、失敗しても次回実行時にリトライされる
  ogFetchRetryCount: 1, // OGP取得のリトライ回数。ワークフローは1時間おきに動くので、失敗しても次回実行時にリトライされる
  generatedFeedFetchTimeoutMs: 10 * 1000,
  generatedFeedMaxResponseBytes: 5 * 1024 * 1024,
};

/**
 * セクションのページURL（末尾スラッシュ付き）を返す
 */
export const sectionPageUrl = (sectionId: string): string =>
  `${siteUrl}${sectionRootPath}/${sectionPathId(sectionId)}/`;

/**
 * セクションのまとめフィードURL一式を返す
 */
export const sectionFeedUrls = (sectionId: string): { atom: string; rss: string; json: string } => ({
  atom: `${sectionPageUrl(sectionId)}feeds/atom.xml`,
  rss: `${sectionPageUrl(sectionId)}feeds/rss.xml`,
  json: `${sectionPageUrl(sectionId)}feeds/feed.json`,
});

/**
 * 生成フィードの公開URL一式を返す
 */
export const generatedFeedUrls = (generatedFeedId: string): { atom: string; rss: string; json: string } => ({
  atom: `${siteUrl}${generatedFeedRootPath}/${generatedFeedId}/atom.xml`,
  rss: `${siteUrl}${generatedFeedRootPath}/${generatedFeedId}/rss.xml`,
  json: `${siteUrl}${generatedFeedRootPath}/${generatedFeedId}/feed.json`,
});
