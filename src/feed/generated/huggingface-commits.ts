import { load } from 'cheerio';
import { removeInvalidUnicode } from '../common-util';
import { parsePublicationDate } from '../publication-metadata';
import type { GeneratedFeedDefinition, GeneratedFeedItem } from './types';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** 変更履歴のコミット日時と不変のコミットURLを教材更新の識別に使う。 */
const commitItem = (data: unknown, repository: string, origin: string): GeneratedFeedItem | null => {
  if (
    !record(data) ||
    !record(data.repo) ||
    data.repo.type !== 'space' ||
    data.repo.name !== repository ||
    !record(data.commit)
  )
    return null;
  const commit = data.commit;
  if (!record(commit.commit) || typeof commit.commit.id !== 'string' || !/^[a-f0-9]{40}$/.test(commit.commit.id))
    return null;
  const publishedAt = parsePublicationDate(commit.date);
  const title = typeof commit.title === 'string' ? removeInvalidUnicode(load(commit.title).text()).trim() : '';
  if (!publishedAt || !title) return null;
  const url = `${origin}/spaces/${repository}/commit/${commit.commit.id}`;
  const authors = Array.isArray(commit.authors)
    ? commit.authors.flatMap((author) =>
        record(author) && typeof author.user === 'string' ? [removeInvalidUnicode(author.user)] : [],
      )
    : [];
  return {
    id: url,
    url,
    title,
    publishedAt,
    summary: '',
    creator: authors.join(', '),
    categories: ['Tutorial updates'],
  };
};

/** 公開Spaceの履歴ページから指定リポジトリのコミットだけを抽出する。 */
export const extractHuggingFaceCommits = (definition: GeneratedFeedDefinition, html: string): GeneratedFeedItem[] => {
  const page = new URL(definition.pageUrl);
  const repository = /^\/spaces\/([^/]+\/[^/]+)\/commits\/[^/]+$/.exec(page.pathname)?.[1];
  if (page.origin !== 'https://huggingface.co' || !repository) throw new Error('Hugging Face Spaceの履歴URLが不正です');
  const $ = load(html);
  const items = new Map<string, GeneratedFeedItem>();
  $('[data-target="Commit"][data-props]').each((_, element) => {
    let data: unknown;
    try {
      data = JSON.parse($(element).attr('data-props') ?? '');
    } catch {
      return;
    }
    const item = commitItem(data, repository, page.origin);
    if (item) items.set(item.id, item);
  });
  if (!items.size) throw new Error('教材の変更履歴を取得できません');
  return [...items.values()];
};
