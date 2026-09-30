import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CustomRssParserFeed } from '../../src/feed/feed-crawler';
import { QiitaOrganizationSupplement } from '../../src/feed/qiita-organization';
import { SourceRequestQueue } from '../../src/feed/source-request';

const location = vi.hoisted(() => ({ directory: '' }));
vi.mock('flat-cache', async (original) => {
  const actual = await original<typeof import('flat-cache')>();
  return {
    ...actual,
    create: (options: Parameters<typeof actual.create>[0]) =>
      actual.create({ ...options, cacheDir: location.directory }),
  };
});
const atom = (id: string, published = '2026-09-30T00:00:00Z', updated = published): string =>
  `<feed xmlns="http://www.w3.org/2005/Atom"><title>Company</title><entry><title>${id}</title><id>${id}</id><link href="https://qiita.com/example/items/${id}"/><published>${published}</published><updated>${updated}</updated></entry></feed>`;
const feed = (): CustomRssParserFeed => ({
  title: 'Company',
  link: 'https://qiita.com/organizations/example',
  sectionId: 'my-tech-blog-jp',
  items: [],
});
beforeEach(async () => {
  location.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'organization-pages-'));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime('2026-09-30T12:00:00Z');
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await fs.rm(location.directory, { recursive: true, force: true });
});

it('後続ページを取得し、更新が新しい過去記事だけで巡回を止めない', async () => {
  const queue = new SourceRequestQueue();
  const fetch = vi
    .spyOn(queue, 'fetchText')
    .mockResolvedValueOnce(atom('old-updated', '2025-01-01T00:00:00Z', '2026-09-30T00:00:00Z'))
    .mockResolvedValueOnce(atom('recent'))
    .mockResolvedValueOnce(atom('old', '2025-01-01T00:00:00Z'));
  const result = feed();
  await new QiitaOrganizationSupplement(queue).enrich(
    result,
    'https://qiita.com/organizations/example/activities.atom',
  );
  expect(result.items.map((i) => i.link)).toEqual([
    'https://qiita.com/example/items/old-updated',
    'https://qiita.com/example/items/recent',
    'https://qiita.com/example/items/old',
  ]);
  expect(fetch.mock.calls.map(([url]) => new URL(url).searchParams.get('page'))).toEqual(['2', '3', '4']);
});

it('ページが繰り返された場合は止まり、途中の取得失敗でも取得済み記事を残す', async () => {
  const queue = new SourceRequestQueue();
  const fetch = vi.spyOn(queue, 'fetchText').mockResolvedValue(atom('same'));
  const result = feed();
  await new QiitaOrganizationSupplement(queue).enrich(
    result,
    'https://qiita.com/organizations/example/activities.atom',
  );
  expect(result.items).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  fetch.mockReset().mockResolvedValueOnce(atom('good')).mockRejectedValueOnce(new Error('timeout'));
  const partial = feed();
  expect(
    await new QiitaOrganizationSupplement(queue).enrich(
      partial,
      'https://qiita.com/organizations/another/activities.atom',
    ),
  ).toBe(false);
  expect(partial.items).toHaveLength(1);
});
