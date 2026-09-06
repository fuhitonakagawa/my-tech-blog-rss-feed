import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FeedCrawler } from '../../src/feed/feed-crawler';
import { GeneratedFeedService } from '../../src/feed/generated/generated-feed-service';
import { FEED_INFO_LIST } from '../../src/resources/feed-info-list';
import { GENERATED_FEED_DEFINITION_MAP } from '../../src/resources/generated-feed-list';

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'serverless-operations-feed-'));

afterAll(async () => {
  await fs.rm(temporaryDirectory, { recursive: true });
});

describe('Serverless Operationsの生成フィード', () => {
  it('単独RSSと国内テックブログ向けの記事を同じXMLから生成する', async () => {
    const definition = GENERATED_FEED_DEFINITION_MAP.get('serverless-operations');
    const feedInfo = FEED_INFO_LIST.find((feed) => feed.input.kind === 'generated' && feed.input.id === definition?.id);
    if (!definition || !feedInfo) {
      throw new Error('Serverless Operationsの生成フィード定義がありません');
    }

    const outputDirectory = path.join(temporaryDirectory, 'output');
    const registry = await new GeneratedFeedService().generate(
      [definition],
      path.join(temporaryDirectory, 'previous'),
      outputDirectory,
    );
    const rss = registry.get(definition.id);
    if (!rss) {
      throw new Error('Serverless OperationsのRSSを生成できません');
    }

    const crawlResult = await new FeedCrawler(registry).crawlFeeds([feedInfo], 1, 5, new Date(0));

    expect(await fs.readFile(path.join(outputDirectory, definition.id, 'rss.xml'), 'utf-8')).toBe(rss);
    expect(crawlResult.feedItems.length).toBeGreaterThan(0);
    expect(crawlResult.feedItems.every((item) => item.sectionId === 'jp-tech-blog')).toBe(true);
    expect(crawlResult.feedItems.every((item) => item.link.startsWith('https://serverless.co.jp/blog/'))).toBe(true);
    expect(crawlResult.feedItems.every((item) => !item.link.includes('/blog/tag/'))).toBe(true);
  });
});
