import { to } from 'await-to-js';
import { XMLValidator } from 'fast-xml-parser';
import RssParser from 'rss-parser';
import { parser as createXmlParser } from 'sax';
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
    this.assertXmlSyntax(label, feedXml);
    const [rssParserError, parsedFeed] = await to(rssParser.parseString(feedXml));
    if (rssParserError) {
      throw new Error(
        `rss-parserによるフィードのバリデーションエラーです。 label: ${label}, error: ${rssParserError}}`,
        {
          cause: rssParserError,
        },
      );
    }

    return parsedFeed;
  }

  /** 記事の日時を解釈せず、XML構文と文字参照の正しさを検証する。 */
  public assertXmlSyntax(label: string, feedXml: string): void {
    createXmlParser(true).write(feedXml).close();
    const atomValidateResult = XMLValidator.validate(feedXml);
    if (atomValidateResult !== true) {
      throw new Error(
        `fast-xml-parser XMLValidatorによるフィードのバリデーションエラーです。 label: ${label}, result: ${atomValidateResult}`,
        {
          cause: atomValidateResult,
        },
      );
    }
  }

  /** 生XMLと解析後の値の双方に対し、制御文字の混入を拒否する。 */
  public assertControlCharacters(label: string, feedXml: string, parsed: unknown): void {
    if (hasInvalidControlCharacters(feedXml) || containsInvalidText(parsed)) {
      throw new Error(`フィードに不正な制御文字が含まれています。 label: ${label}`);
    }
  }
}
