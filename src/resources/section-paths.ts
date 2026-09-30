import definitions from './section-paths.json' with { type: 'json' };

const idPattern = /^[a-z0-9][a-z0-9-]*$/;

/** 管理用IDと固定の公開パスの対応を検証する。 */
export const parseSectionPaths = (value: unknown): ReadonlyMap<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('公開パスの定義が不正です');
  const paths = new Map<string, string>();
  const published = new Set<string>();
  for (const [id, path] of Object.entries(value)) {
    if (!idPattern.test(id) || typeof path !== 'string' || !idPattern.test(path) || published.has(path))
      throw new Error('公開パスのID・重複が不正です');
    paths.set(id, path);
    published.add(path);
  }
  return paths;
};

const paths = parseSectionPaths(definitions);
const ids = new Map([...paths].map(([id, path]) => [path, id]));

/** 閲覧・購読・保存履歴に共通する公開パスID。 */
export const sectionPathId = (id: string): string => paths.get(id) ?? id;

/** 公開パスIDで保存された取得記録を管理用IDへ対応付ける。 */
export const sectionIdFromPath = (path: string): string => ids.get(path) ?? path;

/** 未定義の管理用IDと、通常・翻訳・dedup間の公開パス衝突を拒否する。 */
export const validateSectionPaths = (sectionIds: readonly string[]): void => {
  const active = new Set(sectionIds);
  if ([...paths.keys()].some((id) => !active.has(id))) throw new Error('公開パスに未定義のセクションがあります');
  if (new Set(sectionIds.map(sectionPathId)).size !== sectionIds.length)
    throw new Error('セクションの公開パスが重複しています');
};
