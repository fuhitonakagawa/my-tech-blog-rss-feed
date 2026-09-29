import { to } from 'await-to-js';
import { XMLValidator } from 'fast-xml-parser';
import type { Feed } from 'feed';
import RssParser from 'rss-parser';
import { hasInvalidControlCharacters } from './common-util';

/** 文字参照から復元された制御文字も出力へ含めない。 */
const containsInvalidText = (value: unknown): boolean => {
  if (typeof value === 'string') return hasInvalidControlCharacters(value);
  if (value && typeof value === 'object') return Object.values(value).some(containsInvalidText);
  return false;
};

/**
 * フィードのバリデーション
 */
export class FeedValidator {
  public async assertFeed(feed: Feed): Promise<void> {
    // 一つでもimageがあればok
    let isImageFound = false;
    for (const item of feed.items) {
      if (item.image) {
        isImageFound = true;
        break;
      }
    }
    if (!isImageFound) {
      throw new Error('フィードに画像情報が一つもありません');
    }
  }

  /**
   * XMLの形式・制御文字を検証し、指定した型の解析結果を返す。
   */
  public async assertXmlFeed<F = object, T extends RssParser.Item = RssParser.Item>(
    label: string,
    feedXml: string,
    rssParser: RssParser<F, T> = new RssParser<F, T>(),
  ): Promise<F & RssParser.Output<T>> {
    const parsed = await this.assertXmlStructure(label, feedXml, rssParser);
    this.assertControlCharacters(label, feedXml, parsed);
    return parsed;
  }

  /** XML構造を検証する。外部入力の補正後には制御文字も別途検証する。 */
  public async assertXmlStructure<F = object, T extends RssParser.Item = RssParser.Item>(
    label: string,
    feedXml: string,
    rssParser: RssParser<F, T> = new RssParser<F, T>(),
  ): Promise<F & RssParser.Output<T>> {
    // rss-parser で変換してみてエラーが出ないか確認
    const [rssParserError, parsedFeed] = await to(rssParser.parseString(feedXml));
    if (rssParserError) {
      throw new Error(
        `rss-parserによるフィードのバリデーションエラーです。 label: ${label}, error: ${rssParserError}}`,
        {
          cause: rssParserError,
        },
      );
    }

    // fast-xml-parser XMLValidator でバリデーション
    const atomValidateResult = XMLValidator.validate(feedXml);
    if (atomValidateResult !== true) {
      throw new Error(
        `fast-xml-parser XMLValidatorによるフィードのバリデーションエラーです。 label: ${label}, result: ${atomValidateResult}`,
        {
          cause: atomValidateResult,
        },
      );
    }

    return parsedFeed;
  }

  /** 生XMLと解析後の値の双方に対し、制御文字の混入を拒否する。 */
  public assertControlCharacters(label: string, feedXml: string, parsed: unknown): void {
    if (hasInvalidControlCharacters(feedXml) || containsInvalidText(parsed)) {
      throw new Error(`フィードに不正な制御文字が含まれています。 label: ${label}`);
    }
  }
}
