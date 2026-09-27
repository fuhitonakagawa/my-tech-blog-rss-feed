export type FeedLanguage = 'ja' | 'en' | 'mixed' | 'unknown';

/** 通常フィードの言語指定を検証し、未指定は判定不能として返す */
export const parseFeedLanguage = (value: unknown): FeedLanguage => {
  if (value === undefined) {
    return 'unknown';
  }
  if (value === 'ja' || value === 'en' || value === 'mixed' || value === 'unknown') {
    return value;
  }
  throw new Error('フィードのlanguageはja、en、mixed、unknownのいずれかを指定してください');
};

/** 生成元の言語コードを翻訳対象の言語分類へ変換する */
export const generatedFeedLanguage = (value: string): FeedLanguage => {
  return value === 'en' || value === 'ja' || value === 'mixed' ? value : 'unknown';
};
