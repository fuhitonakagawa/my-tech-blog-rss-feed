import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const braces = require('braces');
const { sprintf } = require('sprintf-js');

it('過度なネスト・循環ASTを再帰処理前に拒否し、通常のglob展開を保持する', () => {
  const nested = `${'{'.repeat(2000)}a,b${'}'.repeat(2000)}`;
  for (const operation of [braces.parse, braces.compile, braces.expand, braces.stringify]) {
    expect(() => operation(nested)).toThrow(SyntaxError);
  }
  const cyclic: { nodes: unknown[] } = { nodes: [] };
  cyclic.nodes.push(cyclic);
  expect(() => braces.compile(cyclic)).toThrow(SyntaxError);
  expect(braces.expand('src/{feed,common}/*.{ts,js}')).toEqual([
    'src/feed/*.ts',
    'src/feed/*.js',
    'src/common/*.ts',
    'src/common/*.js',
  ]);
  expect(braces.compile('a/{b,c}/d')).toBe('a/(b|c)/d');
});

it('過大な数値精度・幅でRangeErrorや巨大なパディングを発生させず、通常の書式を保持する', () => {
  for (const conversion of ['f', 'e', 'g']) {
    const result = sprintf(`%.999999999${conversion}`, 1.25);
    expect(result.length).toBeLessThan(120);
    expect(result).toContain('1');
  }
  expect(sprintf('%999999999s', 'x')).toHaveLength(10000);
  expect(sprintf('%.0f', 1.8)).toBe('2');
  expect(sprintf('%.2f / %04d', 1.25, 3)).toBe('1.25 / 0003');
  expect(sprintf('%(name)s', { name: '日本語' })).toBe('日本語');
});
