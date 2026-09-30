/** 取得の成功と、補助経路だけで取得できた状態を区別する。 */
export interface SourceFetchObservation {
  sourceUrl: string;
  status: 'ok' | 'fallback' | 'partial' | 'error';
  httpStatus: number | null;
}

export interface SourceHealth extends SourceFetchObservation {
  label: string;
  sectionId: string;
  received: number;
  eligible: number;
  excluded: { missingDate: number; outsideWindow: number; future: number; invalidIdentifier: number };
  lastSuccessfulAt: string | null;
  consecutiveFailures: number;
}

/** カテゴリの割当先と、通知用RSSにも対象記事が残っていることを照合する。 */
export interface CoverageCheck {
  kind: 'normal' | 'translated' | 'deduplicated';
  id: string;
  expected: number;
  missing: string[];
}

export interface HealthReport {
  schemaVersion: 1;
  checkedAt: string;
  sources: SourceHealth[];
  coverage: CoverageCheck[];
}
