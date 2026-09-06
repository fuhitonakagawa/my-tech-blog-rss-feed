import * as crypto from 'node:crypto';
import type { FeedDistributionSet } from '../feed-generator';
import { FeedValidator } from '../feed-validator';
import { logger } from '../logger';
import { assertGeneratedFeedExtractor, extractGeneratedFeedItems } from './extractor';
import { buildGeneratedFeed } from './feed-builder';
import { type GeneratedFeedPageFetcher, fetchGeneratedFeedPage } from './page-fetcher';
import { GeneratedFeedStateStore } from './state-store';
import type {
  GeneratedFeedDefinition,
  GeneratedFeedItem,
  GeneratedFeedRegistry,
  GeneratedFeedSnapshot,
  GeneratedFeedStatus,
  StoredGeneratedFeedState,
} from './types';

/** 定義の内容を識別するハッシュを生成する */
const createDefinitionHash = (definition: GeneratedFeedDefinition): string => {
  return crypto.createHash('sha256').update(JSON.stringify(definition)).digest('hex');
};

/** 前回記事と今回記事をIDで統合し、上限件数まで返す */
const mergeItems = (
  previousItems: GeneratedFeedItem[],
  currentItems: GeneratedFeedItem[],
  maxItems: number,
): GeneratedFeedItem[] => {
  const itemMap = new Map(previousItems.map((item) => [item.id, item]));
  for (const item of currentItems) {
    itemMap.set(item.id, item);
  }

  return [...itemMap.values()]
    .sort((left, right) => {
      return right.publishedAt.localeCompare(left.publishedAt) || left.id.localeCompare(right.id);
    })
    .slice(0, maxItems);
};

/** 最小確認間隔内で前回正常RSSを利用できるか判定する */
const canReusePreviousFeed = (
  definition: GeneratedFeedDefinition,
  definitionHash: string,
  previousState: StoredGeneratedFeedState | null,
  currentDate: Date,
): boolean => {
  if (
    !previousState?.status ||
    previousState.status.state !== 'ok' ||
    previousState.snapshot.definitionHash !== definitionHash
  ) {
    return false;
  }

  const elapsedMilliseconds = currentDate.getTime() - new Date(previousState.status.lastCheckedAt).getTime();
  return elapsedMilliseconds >= 0 && elapsedMilliseconds < definition.pollIntervalMinutes * 60 * 1000;
};

/** 生成内容が前回正常時と同一か判定する */
const isSameContent = (
  definition: GeneratedFeedDefinition,
  items: GeneratedFeedItem[],
  previousState: StoredGeneratedFeedState | null,
): boolean => {
  return (
    previousState !== null &&
    previousState.snapshot.label === definition.label &&
    previousState.snapshot.pageUrl === definition.pageUrl &&
    previousState.snapshot.language === definition.language &&
    JSON.stringify(previousState.snapshot.items) === JSON.stringify(items)
  );
};

/** 前回正常状態を優先順に読み込む */
const readPreviousState = async (
  stateStore: GeneratedFeedStateStore,
  rootDirectoryPaths: string[],
  generatedFeedId: string,
): Promise<StoredGeneratedFeedState | null> => {
  for (const rootDirectoryPath of rootDirectoryPaths) {
    try {
      const state = await stateStore.read(rootDirectoryPath, generatedFeedId);
      if (state) {
        return state;
      }
    } catch (error) {
      logger.warn('[generated-feed] 保存済み状態を利用できません', generatedFeedId, rootDirectoryPath);
      logger.trace(error);
    }
  }

  return null;
};

/** スナップショットと現在定義から配信用定義を作る */
const definitionForSnapshot = (
  definition: GeneratedFeedDefinition,
  snapshot: GeneratedFeedSnapshot,
): GeneratedFeedDefinition => ({
  ...definition,
  label: snapshot.label,
  pageUrl: snapshot.pageUrl,
  language: snapshot.language,
});

/** RSS非対応ページの取得、状態統合、単独フィード生成を管理する */
export class GeneratedFeedService {
  private pageFetcher: GeneratedFeedPageFetcher;
  private currentDate: () => Date;
  private stateStore: GeneratedFeedStateStore;
  private feedValidator: FeedValidator;

  constructor(
    pageFetcher: GeneratedFeedPageFetcher = fetchGeneratedFeedPage,
    currentDate: () => Date = () => new Date(),
    stateStore: GeneratedFeedStateStore = new GeneratedFeedStateStore(),
  ) {
    this.pageFetcher = pageFetcher;
    this.currentDate = currentDate;
    this.stateStore = stateStore;
    this.feedValidator = new FeedValidator();
  }

  public async generate(
    definitions: GeneratedFeedDefinition[],
    previousRootDirectoryPath: string,
    outputRootDirectoryPath: string,
  ): Promise<GeneratedFeedRegistry> {
    for (const definition of definitions) {
      assertGeneratedFeedExtractor(definition);
    }

    const previousStates = new Map<string, StoredGeneratedFeedState | null>();
    for (const definition of definitions) {
      previousStates.set(
        definition.id,
        await readPreviousState(this.stateStore, [previousRootDirectoryPath, outputRootDirectoryPath], definition.id),
      );
    }

    await this.stateStore.reset(outputRootDirectoryPath);
    const registry: GeneratedFeedRegistry = new Map();
    for (const definition of definitions) {
      await this.generateOne(definition, previousStates.get(definition.id) ?? null, outputRootDirectoryPath, registry);
    }

    return registry;
  }

  /** 1つの生成元を処理し、利用可能なRSSをレジストリへ登録する */
  private async generateOne(
    definition: GeneratedFeedDefinition,
    previousState: StoredGeneratedFeedState | null,
    outputRootDirectoryPath: string,
    registry: GeneratedFeedRegistry,
  ): Promise<void> {
    const currentDate = this.currentDate();
    const definitionHash = createDefinitionHash(definition);
    if (canReusePreviousFeed(definition, definitionHash, previousState, currentDate) && previousState?.status) {
      try {
        const feeds = this.restoreFeedDistribution(definition, previousState);
        await this.storeAvailableFeed(
          definition.id,
          feeds,
          previousState.snapshot,
          previousState.status,
          outputRootDirectoryPath,
          registry,
        );
        return;
      } catch (error) {
        logger.warn('[generated-feed] 保存済みRSSを再利用できないため生成元を確認します', definition.id);
        logger.trace(error);
      }
    }

    try {
      const html = await this.pageFetcher(definition);
      const currentItems = extractGeneratedFeedItems(definition, html);
      const previousItems = previousState?.snapshot.pageUrl === definition.pageUrl ? previousState.snapshot.items : [];
      const items = mergeItems(previousItems, currentItems, definition.maxItems);
      const sameContent = isSameContent(definition, items, previousState);
      const contentUpdatedAt =
        sameContent && previousState ? previousState.snapshot.contentUpdatedAt : currentDate.toISOString();
      const snapshot: GeneratedFeedSnapshot = {
        schemaVersion: 1,
        id: definition.id,
        definitionHash,
        label: definition.label,
        pageUrl: definition.pageUrl,
        language: definition.language,
        contentUpdatedAt,
        items,
      };
      const feeds =
        sameContent && previousState
          ? this.restoreFeedDistribution(definition, previousState)
          : buildGeneratedFeed(definition, items, contentUpdatedAt);
      const status: GeneratedFeedStatus = {
        schemaVersion: 1,
        id: definition.id,
        state: 'ok',
        lastCheckedAt: currentDate.toISOString(),
        lastSuccessfulAt: currentDate.toISOString(),
        contentUpdatedAt,
      };
      await this.storeAvailableFeed(definition.id, feeds, snapshot, status, outputRootDirectoryPath, registry);
    } catch (error) {
      logger.error('[generated-feed] 生成元の取得または抽出に失敗しました', definition.id);
      logger.trace(error);
      await this.restorePreviousFeed(definition, previousState, currentDate, outputRootDirectoryPath, registry);
    }
  }

  /** RSSを検証し、公開ファイルと内部レジストリへ同じ内容を登録する */
  private async storeAvailableFeed(
    generatedFeedId: string,
    feeds: FeedDistributionSet,
    snapshot: GeneratedFeedSnapshot,
    status: GeneratedFeedStatus,
    outputRootDirectoryPath: string,
    registry: GeneratedFeedRegistry,
  ): Promise<void> {
    await this.validateFeedDistribution(generatedFeedId, feeds);
    await this.stateStore.writeAvailable(outputRootDirectoryPath, generatedFeedId, feeds, snapshot, status);
    registry.set(generatedFeedId, feeds.rss);
  }

  /** 失敗時に前回正常RSSを維持し、利用できなければ未生成状態を保存する */
  private async restorePreviousFeed(
    definition: GeneratedFeedDefinition,
    previousState: StoredGeneratedFeedState | null,
    currentDate: Date,
    outputRootDirectoryPath: string,
    registry: GeneratedFeedRegistry,
  ): Promise<void> {
    if (previousState) {
      try {
        const feeds = this.restoreFeedDistribution(definition, previousState);
        const status: GeneratedFeedStatus = {
          schemaVersion: 1,
          id: definition.id,
          state: 'stale',
          lastCheckedAt: currentDate.toISOString(),
          lastSuccessfulAt: previousState.status?.lastSuccessfulAt ?? previousState.snapshot.contentUpdatedAt,
          contentUpdatedAt: previousState.snapshot.contentUpdatedAt,
        };
        await this.storeAvailableFeed(
          definition.id,
          feeds,
          previousState.snapshot,
          status,
          outputRootDirectoryPath,
          registry,
        );
        return;
      } catch (error) {
        logger.error('[generated-feed] 前回正常RSSを復元できません', definition.id);
        logger.trace(error);
      }
    }

    await this.stateStore.writeUnavailable(outputRootDirectoryPath, definition.id, {
      schemaVersion: 1,
      id: definition.id,
      state: 'unavailable',
      lastCheckedAt: currentDate.toISOString(),
      lastSuccessfulAt: null,
      contentUpdatedAt: null,
    });
  }

  /** 正常スナップショットから配信形式を復元する */
  private restoreFeedDistribution(
    definition: GeneratedFeedDefinition,
    previousState: StoredGeneratedFeedState,
  ): FeedDistributionSet {
    return buildGeneratedFeed(
      definitionForSnapshot(definition, previousState.snapshot),
      previousState.snapshot.items,
      previousState.snapshot.contentUpdatedAt,
    );
  }

  /** 生成元ごとの配信形式を検証する */
  private async validateFeedDistribution(generatedFeedId: string, feeds: FeedDistributionSet): Promise<void> {
    await this.feedValidator.assertXmlFeed(`${generatedFeedId}-generated-rss`, feeds.rss);
    await this.feedValidator.assertXmlFeed(`${generatedFeedId}-generated-atom`, feeds.atom);
    JSON.parse(feeds.json);
  }
}
