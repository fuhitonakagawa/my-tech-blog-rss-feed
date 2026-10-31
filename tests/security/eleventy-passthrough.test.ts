import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { expect, it } from 'vitest';

const run = promisify(execFile);
const eleventy = resolve('node_modules/@11ty/eleventy/cmd.cjs');

it('minimatchの更新後もEleventyが公開ファイル・圧縮履歴・globの除外条件を保持する', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eleventy-passthrough-'));
  const history = gzipSync(JSON.stringify({ articles: [{ id: '既存の記事', publishedAt: '2026-01-01' }] }));
  const files = {
    'input/index.html': '<p>公開ページ</p>',
    'input/feeds/rss.xml': '<rss version="2.0"><channel><title>記事</title></channel></rss>',
    'input/feeds/statistics/state.json.gz': history,
    'input/feeds/.hidden.json': '{}',
    'input/images/icon.svg': '<svg/>',
    'input/images/nested/icon.png': Buffer.from([137, 80, 78, 71]),
    'input/images/private/icon.svg': '<svg>非公開</svg>',
    'input/images/draft.txt': '対象外',
    'LICENSE.txt': 'ライセンス表示',
  };
  try {
    for (const [name, content] of Object.entries(files)) {
      await mkdir(dirname(join(root, name)), { recursive: true });
      await writeFile(join(root, name), content);
    }
    await writeFile(
      join(root, 'eleventy.config.cjs'),
      `module.exports = (config) => {
        config.addPassthroughCopy({ 'input/feeds': 'feeds', 'LICENSE.txt': 'LICENSE.txt' });
        config.addPassthroughCopy({ 'input/images': 'images' }, {
          filter: ['**/*.{svg,png}', '!private/**'],
        });
        return { dir: { input: 'input', output: 'output' } };
      };`,
    );
    await run(process.execPath, [eleventy, '--config=eleventy.config.cjs'], { cwd: root });
    const copied = [
      'feeds/rss.xml',
      'feeds/statistics/state.json.gz',
      'feeds/.hidden.json',
      'images/icon.svg',
      'images/nested/icon.png',
    ];
    for (const name of copied) {
      expect(await readFile(join(root, 'output', name))).toEqual(await readFile(join(root, 'input', name)));
    }
    expect(await readFile(join(root, 'output/LICENSE.txt'), 'utf8')).toBe(files['LICENSE.txt']);
    expect(await readFile(join(root, 'output/index.html'), 'utf8')).toContain('公開ページ');
    expect((await readdir(join(root, 'output/images'), { recursive: true })).sort()).toEqual([
      'icon.svg',
      'nested',
      'nested/icon.png',
    ]);

    await writeFile(join(root, 'input/feeds/rss.xml'), '<rss>更新</rss>');
    await run(process.execPath, [eleventy, '--config=eleventy.config.cjs'], { cwd: root });
    expect(await readFile(join(root, 'output/feeds/rss.xml'), 'utf8')).toBe('<rss>更新</rss>');
    expect(await readFile(join(root, 'output/feeds/statistics/state.json.gz'))).toEqual(history);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
