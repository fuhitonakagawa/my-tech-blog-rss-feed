/** 記事本文やURLを含まないカテゴリ別の取得記録。 */
export interface ArticleObservation {
  articleId: string;
  /** 取得元RSSの識別子。取得元を特定できない保存履歴ではnull。 */
  sourceId: string | null;
  sectionId: string;
  sectionTitle: string;
  publishedAt: string;
}

export interface CategoryCount {
  sectionId: string;
  title: string;
  count: number;
}

/** 同じ日付の統計は固定IDで配信し、遅延取得時は内容を更新する。 */
export interface DailyReport {
  date: string;
  publishedAt: string;
  updatedAt: string;
  coverage: 'observed' | 'partial' | 'unobserved';
  categories: CategoryCount[];
}

/** 公開済み履歴と次回集計用の取得記録。 */
export interface StatisticsState {
  schemaVersion: 2;
  startedAt: string;
  lastCollectedAt: string;
  collectionDays: string[];
  observations: ArticleObservation[];
  reports: DailyReport[];
}
