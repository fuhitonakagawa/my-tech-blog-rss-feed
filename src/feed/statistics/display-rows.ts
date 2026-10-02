import type { CategoryCount } from './types';

export interface StatisticsDisplayRow {
  category: CategoryCount;
  parts: { title: string; count: number }[];
  children: CategoryCount[];
  grouped: boolean;
}

/** 投稿サービス名とタグの説明を除いた、内訳用の短いカテゴリ名。 */
const shortTitle = (title: string): string => title.replace(/^(?:Zenn|Qiita)\s+/, '').replace(/(?:関連)?タグ$/, '');

/** 元カテゴリと派生カテゴリを同じ行にまとめ、日次の実件数順で表示する。 */
export const statisticsDisplayRows = (categories: readonly CategoryCount[]): StatisticsDisplayRow[] => {
  const byId = new Map(categories.map((category) => [category.sectionId, category]));
  const hidden = new Set<string>();
  const rows = categories.map((category): StatisticsDisplayRow => {
    const row: StatisticsDisplayRow = { category, parts: [], children: [], grouped: false };
    if (category.kind === 'deduplicated' && category.sourceCategories) {
      row.grouped = true;
      row.parts = category.sourceCategories.map((part) => ({ title: shortTitle(part.title), count: part.count }));
      for (const part of category.sourceCategories) {
        const child = part.sectionId && byId.get(part.sectionId);
        if (child) {
          hidden.add(child.sectionId);
          row.children.push(child);
        }
      }
    }
    const translation = categories.find(
      (item) => item.kind === 'translated' && item.sourceSectionId === category.sectionId,
    );
    if (translation && category.languageCounts !== undefined) {
      row.grouped = true;
      row.parts = [
        ...Object.entries(category.languageCounts ?? {}).map(([title, count]) => ({ title, count })),
        { title: 'translated-jp', count: translation.count },
      ];
      row.children = [translation];
      hidden.add(translation.sectionId);
    }
    return row;
  });
  return rows
    .filter((row) => !hidden.has(row.category.sectionId))
    .sort((a, b) => b.category.count - a.category.count || a.category.sectionId.localeCompare(b.category.sectionId));
};

/** 内訳の合計を総数として扱わず、それぞれの掲載件数を表示する。 */
export const statisticsBreakdownText = (row: StatisticsDisplayRow): string =>
  row.parts.length ? `（${row.parts.map((part) => `${part.title} ${part.count}件`).join(' / ')}）` : '';
