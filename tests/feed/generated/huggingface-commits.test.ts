import { expect, it } from 'vitest';
import { extractHuggingFaceCommits } from '../../../src/feed/generated/huggingface-commits';
import { GENERATED_FEED_DEFINITION_MAP } from '../../../src/resources/generated-feed-list';

const definition = GENERATED_FEED_DEFINITION_MAP.get('lerobot-tutorial-updates');
if (!definition) throw new Error('定義がありません');
const good = {
  repo: { name: 'lerobot/robot-learning-tutorial', type: 'space' },
  commit: {
    date: '2025-10-15T09:24:40.000Z',
    title: 'Update tutorial & examples',
    authors: [{ user: 'author' }],
    commit: { id: 'a'.repeat(40) },
  },
};
const html = (items: unknown[]): string =>
  items
    .map(
      (item) =>
        `<div data-target="Commit" data-props="${JSON.stringify(item).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"></div>`,
    )
    .join('');

it('リポジトリ・コミットID・UTC日時を検証し、重複や別リポジトリを除外する', () => {
  const items = extractHuggingFaceCommits(
    definition,
    html([
      good,
      good,
      { ...good, repo: { name: 'other/repo', type: 'space' } },
      { ...good, commit: { ...good.commit, date: '2026-02-30' } },
      { ...good, commit: { ...good.commit, commit: { id: '../bad' } } },
    ]),
  );
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    title: good.commit.title,
    publishedAt: good.commit.date,
    url: `https://huggingface.co/spaces/lerobot/robot-learning-tutorial/commit/${'a'.repeat(40)}`,
    creator: 'author',
  });
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
