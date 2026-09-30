/** 翻訳プロバイダー。idはエンジンとモデルのバージョンを含む */
export interface Translator {
  readonly id: string;
  readonly limits: TranslationLimits;
  /** 入力順で翻訳を返す。個別に失敗したテキストは空文字で表す */
  translateMany(texts: string[], sourceLanguage: string, targetLanguage: string): Promise<string[]>;
}
/** Python設定から受け取る翻訳入力と実行時間の上限。 */
export interface TranslationLimits {
  totalTimeoutMs: number;
  batchTimeoutMs: number;
  maxBatchTexts: number;
  maxBatchBytes: number;
  maxTextBytes: number;
}
