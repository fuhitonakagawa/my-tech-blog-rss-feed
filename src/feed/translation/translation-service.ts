import { removeInvalidUnicode } from '../common-util';
import type { CustomRssParserItem } from '../feed-crawler';
import { logger } from '../logger';
import { type TranslationCache, translationCacheKey } from './translation-cache';
import type { TranslationLimits, Translator } from './translator';

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

/** JSON通信量と件数が上限内のテキスト集合だけを返す。 */
const translationBatches = (texts: string[], source: string, target: string, limits: TranslationLimits): string[][] => {
  const overhead = Buffer.byteLength(JSON.stringify({ sourceLanguage: source, targetLanguage: target, texts: [] }));
  const batches: string[][] = [];
  let batch: string[] = [];
  let bytes = overhead;
  let oversized = 0;
  for (const text of texts) {
    const size = Buffer.byteLength(JSON.stringify(text));
    if (Buffer.byteLength(text) > limits.maxTextBytes || overhead + size > limits.maxBatchBytes) {
      oversized++;
      continue;
    }
    if (batch.length && (batch.length >= limits.maxBatchTexts || bytes + size + 1 > limits.maxBatchBytes)) {
      batches.push(batch);
      batch = [];
      bytes = overhead;
    }
    bytes += size + (batch.length ? 1 : 0);
    batch.push(text);
  }
  if (batch.length) batches.push(batch);
  if (oversized) logger.warn('[translate] input-too-large', { count: oversized });
  return batches;
};

export interface TranslationBudget {
  startedAt?: number;
  deadline?: number;
}

/** 原文を変更せず、キャッシュとプロバイダーから翻訳記事を組み立てる */
export class TranslationService {
  constructor(
    private readonly translator: Translator,
    private readonly cache: TranslationCache,
    private readonly budget: TranslationBudget = {},
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
    this.budget.deadline ??= (this.budget.startedAt ?? Date.now()) + this.translator.limits.totalTimeoutMs;
    const deadline = this.budget.deadline;
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
    logger.info('[translate] planned', { source, target, cached: translations.size, pending: missing.length });
    for (const batch of translationBatches(missing, source, target, this.translator.limits)) {
      if (Date.now() + this.translator.limits.batchTimeoutMs > deadline) {
        logger.warn('[translate] time-budget-exhausted', { provider: this.translator.id });
        break;
      }
      await this.translateBatch(batch, source, target, translations);
    }
    return translations;
  }

  /** 成功結果を保存し、失敗の影響を当該バッチへ限定する。 */
  private async translateBatch(
    texts: string[],
    source: string,
    target: string,
    translations: Map<string, string>,
  ): Promise<void> {
    try {
      const translated = await this.translator.translateMany(texts, source, target);
      if (translated.length !== texts.length || translated.some((value) => typeof value !== 'string')) {
        throw new Error('翻訳結果の件数または型が不正です');
      }
      for (const [index, text] of texts.entries()) {
        const translation = validTranslation(translated[index]);
        if (translation === undefined) {
          continue;
        }
        translations.set(text, translation);
        await this.cache.write(translationCacheKey(this.translator.id, source, target, text), translation);
      }
      logger.info('[translate] batch', { provider: this.translator.id, requested: texts.length });
    } catch {
      logger.warn('[translate] provider-failed', { provider: this.translator.id, requested: texts.length });
    }
  }
}
