/** 翻訳プロバイダー。idはエンジンとモデルのバージョンを含む */
export interface Translator {
  readonly id: string;
  /** 入力順で翻訳を返す。個別に失敗したテキストは空文字で表す */
  translateMany(texts: string[], sourceLanguage: string, targetLanguage: string): Promise<string[]>;
}
