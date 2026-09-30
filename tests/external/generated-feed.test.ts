import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FeedCrawler } from '../../src/feed/feed-crawler';
import { GeneratedFeedService } from '../../src/feed/generated/generated-feed-service';
import { FEED_INFO_LIST } from '../../src/resources/feed-info-list';
import { GENERATED_FEED_DEFINITION_MAP } from '../../src/resources/generated-feed-list';

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'generated-feed-'));

afterAll(async () => {
  await fs.rm(temporaryDirectory, { recursive: true });
});

describe.each([
  { id: 'serverless-operations', sectionId: 'my-tech-blog-jp', articlePrefix: 'https://serverless.co.jp/blog/' },
  { id: 'anthropic-news', sectionId: 'my-tech-blog-ai', articlePrefix: 'https://www.anthropic.com/' },
  { id: 'claude-announcements', sectionId: 'my-tech-blog-ai', articlePrefix: 'https://claude.com/blog/' },
  { id: 'claude-code-blog', sectionId: 'my-tech-blog-ai', articlePrefix: 'https://claude.com/blog/' },
])('$idの生成フィード', ({ id, sectionId, articlePrefix }) => {
  it('単独RSSと所属セクションの記事を同じXMLから生成する', async () => {
    const definition = GENERATED_FEED_DEFINITION_MAP.get(id);
    const feedInfo = FEED_INFO_LIST.find((feed) => feed.input.kind === 'generated' && feed.input.id === definition?.id);
    if (!definition || !feedInfo) {
      throw new Error(`${id}の生成フィード定義がありません`);
    }

    const outputDirectory = path.join(temporaryDirectory, id, 'output');
    const registry = await new GeneratedFeedService().generate(
      [definition],
      path.join(temporaryDirectory, 'previous'),
      outputDirectory,
    );
    const rss = registry.get(definition.id);
    if (!rss) {
      throw new Error(`${id}のRSSを生成できません`);
    }

    const crawlResult = await new FeedCrawler(registry).crawlFeeds([feedInfo], 1, 5, new Date(0));

    expect(await fs.readFile(path.join(outputDirectory, definition.id, 'rss.xml'), 'utf-8')).toBe(rss);
    expect(crawlResult.feedItems.length).toBeGreaterThan(0);
    expect(crawlResult.feedItems.every((item) => item.sectionId === sectionId)).toBe(true);
    expect(crawlResult.feedItems.every((item) => item.link.startsWith(articlePrefix))).toBe(true);
    expect(crawlResult.feedItems.every((item) => !item.link.includes('/blog/tag/'))).toBe(true);
    const status = JSON.parse(await fs.readFile(path.join(outputDirectory, id, 'status.json'), 'utf-8'));
    expect(status.state).toBe('ok');
  });
});
