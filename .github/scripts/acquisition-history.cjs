const fs = require('node:fs/promises');
const path = require('node:path');
exports.createStore = ({branch, allowed, marker = 'index.json'}) => {

// 専用ブランチは本番だけが更新し、画像キャッシュの削除・他ジョブの保存から独立させる。
async function current(github, owner, repo) {
  try { return (await github.rest.git.getRef({ owner, repo, ref: `heads/${branch}` })).data.object.sha; }
  catch (error) { if (error.status === 404) return null; throw error; }
}

async function checkedFiles(directory) {
  const result = [];
  for (const name of await fs.readdir(directory)) {
    if (!allowed.test(name)) throw new Error('取得記録に許可されていないファイルがあります');
    const file = path.join(directory, name);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error('取得記録のファイルが不正です');
    const content = await fs.readFile(file, 'utf8');
    JSON.parse(content);
    result.push({ name, content });
  }
  if (!result.some((entry) => entry.name === marker)) throw new Error('取得記録の保存完了情報がありません');
  return result;
}

const restore = async ({ github, context, core }, directory = '.feed-acquisition') => {
  const { owner, repo } = context.repo;
  const sha = await current(github, owner, repo);
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
  if (!sha) { core.info('専用取得記録は初回。旧キャッシュからの移行を許可します。'); return null; }
  const commit = (await github.rest.git.getCommit({ owner, repo, commit_sha: sha })).data;
  const tree = (await github.rest.git.getTree({ owner, repo, tree_sha: commit.tree.sha })).data;
  if (tree.truncated) throw new Error('取得記録のファイル一覧が省略されました');
  for (const entry of tree.tree) {
    if (entry.type !== 'blob' || entry.mode !== '100644' || !allowed.test(entry.path) || entry.size > 32 * 1024 * 1024)
      throw new Error('保存された取得記録に不正なファイルがあります');
    const blob = (await github.rest.git.getBlob({ owner, repo, file_sha: entry.sha })).data;
    if (blob.encoding !== 'base64') throw new Error('取得記録のエンコードが不正です');
    await fs.writeFile(path.join(directory, entry.path), Buffer.from(blob.content, 'base64'));
  }
  await checkedFiles(directory);
  core.info(`本番の専用取得記録を復元しました: ${sha}`);
  return sha;
};

const save = async ({ github, context, core }, directory = '.feed-acquisition') => {
  const { owner, repo } = context.repo;
  const files = await checkedFiles(directory);
  const parent = await current(github, owner, repo);
  const metadata = JSON.parse(files.find(file => file.name === marker).content);
  if (!Object.hasOwn(metadata, 'baseCommit') || metadata.baseCommit !== parent)
    throw new Error('取得記録が復元後に更新されました。再実行して最新記録から復元してください');
  const tree = [];
  for (const file of files) {
    const blob = (await github.rest.git.createBlob({ owner, repo, content: file.content, encoding: 'utf-8' })).data;
    tree.push({ path: file.name, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const createdTree = (await github.rest.git.createTree({ owner, repo, tree })).data;
  const commit = (await github.rest.git.createCommit({ owner, repo, message: 'chore: persist acquired RSS articles',
    tree: createdTree.sha, parents: parent ? [parent] : [] })).data;
  if (parent) await github.rest.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha, force: false });
  else await github.rest.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: commit.sha });
  core.info(`取得記録を公開成否と独立して保存しました: ${commit.sha}`);
};

return {restore, save};
};
Object.assign(exports, exports.createStore({branch: 'feed-acquisition-history',
  allowed: /^(?:index|feed-acquisition-v1-[a-f0-9]{64})\.json$/}));

// 専用保存が失敗した本番実行のバックアップだけを選び、PRやCIの記録を採用しない。
exports.findFailedBackup = async ({github, context, core}, workflow, artifactName) => {
  const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
    ...context.repo, workflow_id: workflow, branch: 'main', status: 'failure', per_page: 100,
    created: `>=${new Date(Date.now() - 30 * 86400000).toISOString()}`
  });
  for (const run of runs) {
    if (!['push', 'schedule', 'workflow_dispatch', 'workflow_run'].includes(run.event)) continue;
    const artifacts = (await github.rest.actions.listWorkflowRunArtifacts({
      ...context.repo, run_id: run.id, per_page: 100
    })).data.artifacts;
    if (artifacts.some(artifact => artifact.name === artifactName && !artifact.expired)) {
      core.info(`失敗した本番実行のバックアップを復元します: ${run.html_url}`);
      return String(run.id);
    }
  }
  return '';
};
