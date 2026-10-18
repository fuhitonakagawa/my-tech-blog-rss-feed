import { expect, it } from 'vitest';
import { extractHuggingFaceCommits } from '../../../src/feed/generated/huggingface-commits';
import { GENERATED_FEED_DEFINITION_MAP } from '../../../src/resources/generated-feed-list';

const definition = GENERATED_FEED_DEFINITION_MAP.get('lerobot-tutorial-updates');
if (!definition) throw new Error('定義がありません');
const commit = {
  date: '2025-10-15T09:24:40.000Z',
  title: 'Update tutorial & examples',
  authors: [{ user: 'author' }],
  commit: { id: 'a'.repeat(40) },
};
const good = {
  repo: { name: 'lerobot/robot-learning-tutorial', type: 'space' },
  commits: [commit],
};
const html = (items: unknown[]): string =>
  items
    .map(
      (item) =>
        `<div data-target="CommitHistoryList" data-props="${JSON.stringify(item).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"></div>`,
    )
    .join('');

it('履歴一覧の埋め込みデータから複数コミットを抽出する', () => {
  const second = {
    ...commit,
    date: '2025-10-15T07:49:55.000Z',
    title: 'Fix tutorial thumbnail',
    commit: { id: 'b'.repeat(40) },
  };
  const items = extractHuggingFaceCommits(definition, html([{ ...good, commits: [commit, second] }]));
  expect(items.map((item) => ({ title: item.title, publishedAt: item.publishedAt, url: item.url }))).toEqual(
    [commit, second].map((value) => ({
      title: value.title,
      publishedAt: value.date,
      url: `https://huggingface.co/spaces/lerobot/robot-learning-tutorial/commit/${value.commit.id}`,
    })),
  );
});

it('リポジトリ・コミットID・UTC日時を検証し、重複や別リポジトリを除外する', () => {
  const items = extractHuggingFaceCommits(
    definition,
    html([
      good,
      good,
      { ...good, repo: { name: 'other/repo', type: 'space' } },
      { ...good, repo: { ...good.repo, type: 'model' } },
      {
        ...good,
        commits: [
          { ...commit, date: '2026-02-30' },
          { ...commit, commit: { id: '../bad' } },
        ],
      },
      { ...good, commits: [null, { ...commit, title: '' }, { ...commit, commit: null }] },
    ]),
  );
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    title: commit.title,
    publishedAt: commit.date,
    url: `https://huggingface.co/spaces/lerobot/robot-learning-tutorial/commit/${'a'.repeat(40)}`,
    creator: 'author',
  });
});

it.each(
  [null, [], { ...good, commits: null }, { ...good, commits: {} }, { ...good, commits: [] }, { commits: [commit] }].map(
    (data) => ({ data }),
  ),
)('不正な履歴一覧を取得成功として扱わない: $data', ({ data }) => {
  expect(() => extractHuggingFaceCommits(definition, html([data]))).toThrow('教材の変更履歴を取得できません');
});

it('壊れた埋め込みJSONを除外して正常な一覧を抽出する', () => {
  const broken = '<div data-target="CommitHistoryList" data-props="{invalid}"></div>';
  expect(extractHuggingFaceCommits(definition, broken + html([good]))).toHaveLength(1);
  expect(() => extractHuggingFaceCommits(definition, broken)).toThrow('教材の変更履歴を取得できません');
});

it('日時やコミット情報がないページを取得成功として扱わない', () => {
  expect(() => extractHuggingFaceCommits(definition, '<html>Not found</html>')).toThrow();
  expect(() =>
    extractHuggingFaceCommits(
      { ...definition, pageUrl: 'https://example.com/spaces/lerobot/robot-learning-tutorial/commits/main' },
      html([good]),
    ),
  ).toThrow();
});
