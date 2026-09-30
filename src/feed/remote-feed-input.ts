import { type CheerioAPI, load } from 'cheerio';
import type RssParser from 'rss-parser';
import { hasInvalidControlCharacters, removeInvalidUnicode } from './common-util';
import { FeedValidator } from './feed-validator';
import { logger } from './logger';

type XmlSelection = ReturnType<CheerioAPI>;
interface InputRepairs {
  clearedDescriptions: number;
  repairedTitles: number;
  droppedItems: number;
}

const descriptionNames = new Set(['description', 'summary', 'content', 'content:encoded']);
const identityNames = new Set(['link', 'guid', 'id']);
const urlAttributes = new Set(['href', 'src', 'url', 'rdf:about', 'rdf:resource']);
const damagedText = (text: string): boolean => hasInvalidControlCharacters(text) || text.includes('\uFFFD');
/** HTML形式の概要に埋め込まれた文字参照も表示時の文字として検査する。 */
const damagedDescription = (text: string): boolean => damagedText(text) || damagedText(load(text).text());
/** 識別子に埋め込まれた改行・タブも除去による別URL化を避けるため拒否する。 */
const damagedIdentity = (text: string): boolean =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: 識別子内の制御文字を検出する
  /[\x00-\x1F\x7F-\x9F\uD800-\uDFFF\uFFFD-\uFFFF]/u.test(text.trim());

/** Atomの日時不正と、存在しない日付の自動繰り上がりを拒否する。 */
const invalidAtomDate = (document: CheerioAPI, item: XmlSelection): boolean => {
  if (!item.is('entry')) return false;
  return item
    .children('published,updated')
    .toArray()
    .some((element) => {
      const value = document(element).text();
      if (value === '') return false;
      if (!Number.isFinite(Date.parse(value))) return true;
      const date = /^(\d{4}-\d{2}-\d{2})(?:T|\s|$)/.exec(value.trim())?.[1];
      if (!date) return false;
      const midnight = new Date(`${date}T00:00:00.000Z`);
      return !Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== date;
    });
};

/** 表示文の破損は表示文だけへ閉じ込め、URL・属性・GUIDを補正しない。 */
const repairTextFields = (document: CheerioAPI, parent: XmlSelection, repairs: InputRepairs): void => {
  parent.children().each((_, element) => {
    const field = document(element);
    if (descriptionNames.has(element.name) && damagedDescription(field.text())) {
      field.empty();
      repairs.clearedDescriptions++;
    } else if (element.name === 'title' && hasInvalidControlCharacters(field.text())) {
      field.text(removeInvalidUnicode(field.text()));
      repairs.repairedTitles++;
    }
  });
};

/** 任意の属性や未対応の項目に破損が残る記事を識別する。 */
const damagedItem = (document: CheerioAPI, item: XmlSelection): boolean => {
  const title = item.children('title');
  if (title.length && !title.text().trim()) return true;
  return item
    .find('*')
    .addBack()
    .toArray()
    .some((element) => {
      const node = document(element);
      if (hasInvalidControlCharacters(node.text())) return true;
      if ('name' in element && identityNames.has(element.name) && damagedIdentity(node.text())) return true;
      return Object.entries(node.attr() ?? {}).some(([name, value]) =>
        urlAttributes.has(name) ? damagedIdentity(value) : damagedText(value),
      );
    });
};

/** 構造検証済みXMLの表示項目を補正し、識別情報が壊れた記事だけ除外する。 */
const repairFeedDocument = (xml: string): { xml: string; repairs: InputRepairs } => {
  const document = load(xml, { xml: true });
  const repairs: InputRepairs = { clearedDescriptions: 0, repairedTitles: 0, droppedItems: 0 };
  document('rss > channel > item, rdf\\:RDF > item, feed > entry').each((_, element) => {
    const item = document(element);
    repairTextFields(document, item, repairs);
    if (damagedItem(document, item) || invalidAtomDate(document, item)) {
      const about = item.attr('rdf:about');
      if (about) {
        document('rdf\\:li')
          .filter((_, reference) => document(reference).attr('rdf:resource') === about)
          .remove();
      }
      item.remove();
      repairs.droppedItems++;
    }
  });
  document('channel, feed').each((_, element) => repairTextFields(document, document(element), repairs));
  if (damagedItem(document, document.root())) throw new Error('外部RSSのメタデータに不正な文字があります');
  const changed = Object.values(repairs).some((count) => count > 0);
  return { xml: changed ? document.xml() : xml, repairs };
};

/** 構造検証・記事単位の隔離・厳格な再検証を通した外部RSSだけを返す。 */
export const parseRemoteFeed = async <F, T extends RssParser.Item>(
  xml: string,
  parser: RssParser<F, T>,
  label: string,
): Promise<{ xml: string; feed: F & RssParser.Output<T> }> => {
  const validator = new FeedValidator();
  validator.assertXmlSyntax('remote-feed', xml);
  const result = repairFeedDocument(xml);
  const feed = await validator.assertXmlFeed('normalized-remote-feed', result.xml, parser);
  if (result.xml !== xml) logger.warn('[feed-input] repaired', { label, ...result.repairs });
  return { xml: result.xml, feed };
};
