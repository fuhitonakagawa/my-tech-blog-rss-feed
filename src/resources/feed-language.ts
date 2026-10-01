export type FeedLanguage = 'ja' | 'en' | 'zh' | 'mixed' | 'unknown';

/** 通常フィードの言語指定を検証し、未指定は判定不能として返す */
export const parseFeedLanguage = (value: unknown): FeedLanguage => {
  if (value === undefined) {
    return 'unknown';
  }
  if (value === 'ja' || value === 'en' || value === 'zh' || value === 'mixed' || value === 'unknown') {
    return value;
  }
  throw new Error('フィードのlanguageはja、en、zh、mixed、unknownのいずれかを指定してください');
};

/** 生成元の言語コードを翻訳対象の言語分類へ変換する */
export const generatedFeedLanguage = (value: string): FeedLanguage => {
  return value === 'en' || value === 'ja' || value === 'zh' || value === 'mixed' ? value : 'unknown';
};

/** 全取得元が同じ既知言語のカテゴリだけ、配信言語を明示する。 */
export const sectionFeedLanguage = (feeds: readonly { language: FeedLanguage }[]): 'ja' | 'en' | 'zh' | undefined => {
  const languages = new Set(feeds.map((feed) => feed.language));
  const language = feeds[0]?.language;
  return languages.size === 1 && (language === 'ja' || language === 'en' || language === 'zh') ? language : undefined;
};
