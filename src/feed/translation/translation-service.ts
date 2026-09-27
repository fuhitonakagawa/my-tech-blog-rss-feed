import { removeInvalidUnicode } from '../common-util';
import type { CustomRssParserItem } from '../feed-crawler';
import { logger } from '../logger';
import { type TranslationCache, translationCacheKey } from './translation-cache';
import type { Translator } from './translator';

/** 記事がフィードに使用する概要文を返す */
const sourceSummary = (item: CustomRssParserItem): string => item.summary || item.contentSnippet || '';

/** フィードに出力できる空でない翻訳テキストだけを返す */
const validTranslation = (text: string | undefined): string | undefined => {
  if (text === undefined) {
    return undefined;
  }
  const normalized = removeInvalidUnicode(text.replace(/[\r\n\t]/g, ' '));
  return normalized.trim() === '' ? undefined : normalized;
};

/** 原文を変更せず、キャッシュとプロバイダーから翻訳記事を組み立てる */
export class TranslationService {
  constructor(
    private readonly translator: Translator,
    private readonly cache: TranslationCache,
  ) {}

  public async translateItems(
    items: readonly CustomRssParserItem[],
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<CustomRssParserItem[]> {
    const texts = [...new Set(items.flatMap((item) => [item.title ?? '', sourceSummary(item)]))].filter(
      (text) => text.trim() !== '',
    );
    const translations = await this.translateTexts(texts, sourceLanguage, targetLanguage);
    let fallbackCount = 0;
    const results = items.map((item) => {
      const title = item.title ?? '';
      const summary = sourceSummary(item);
      const translatedTitle = title.trim() ? translations.get(title) : title;
      const translatedSummary = summary.trim() ? translations.get(summary) : summary;
      if (translatedTitle === undefined || translatedSummary === undefined) {
        fallbackCount++;
        return { ...item, originalTitle: item.originalTitle ?? title };
      }
      return {
        ...item,
        originalTitle: item.originalTitle ?? title,
        title: translatedTitle,
        summary: translatedSummary,
        contentSnippet: translatedSummary,
      };
    });
    if (fallbackCount > 0) {
      logger.warn('[translate] original-fallback', { provider: this.translator.id, count: fallbackCount });
    }
    return results;
  }

  /** 同一原文は一度だけ翻訳し、有効な結果のみキャッシュする */
  private async translateTexts(texts: string[], source: string, target: string): Promise<Map<string, string>> {
    const translations = new Map<string, string>();
    const missing: string[] = [];
    for (const text of texts) {
      const cached = validTranslation(
        await this.cache.read(translationCacheKey(this.translator.id, source, target, text)),
      );
      if (cached !== undefined) {
        translations.set(text, cached);
      } else {
        missing.push(text);
      }
    }
    if (missing.length === 0) {
      return translations;
    }
    try {
      const translated = await this.translator.translateMany(missing, source, target);
      if (translated.length !== missing.length || translated.some((value) => typeof value !== 'string')) {
        throw new Error('翻訳結果の件数または型が不正です');
      }
      for (const [index, text] of missing.entries()) {
        const translation = validTranslation(translated[index]);
        if (translation === undefined) {
          continue;
        }
        translations.set(text, translation);
        await this.cache.write(translationCacheKey(this.translator.id, source, target, text), translation);
      }
      logger.info('[translate] batch', { provider: this.translator.id, requested: missing.length });
    } catch {
      logger.warn('[translate] provider-failed', { provider: this.translator.id, requested: missing.length });
    }
    return translations;
  }
}
