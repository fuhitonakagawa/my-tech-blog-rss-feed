const fs = require('node:fs/promises');

// 配置コミットとPagesの実行・公開済み履歴を照合し、生成の成功だけで終了しない。
module.exports = async ({ github, context, core }, options = {}) => {
  const { owner, repo } = context.repo;
  const expected = JSON.parse(await fs.readFile(options.manifest || 'public/feeds/delivery/index.json', 'utf8'));
  const branch = (await github.rest.repos.getBranch({ owner, repo, branch: 'gh-pages' })).data;
  const sha = branch.commit.sha;
  const started = Date.now();
  const timeout = options.timeout || 8 * 60 * 1000;
  const pause = options.pause || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const read = options.fetch || globalThis.fetch;
  let retries = 0;
  let retriedAttempt = 0;
  let url = '';
  while (Date.now() - started < timeout) {
    const runs = (await github.rest.actions.listWorkflowRunsForRepo({ owner, repo, head_sha: sha, per_page: 20 })).data.workflow_runs;
    const run = runs.find((entry) => entry.path === 'dynamic/pages/pages-build-deployment');
    if (run) {
      url = run.html_url;
      if (run.status === 'completed' && run.conclusion === 'success') {
        try {
          const response = await read(`https://fuhitonakagawa.github.io/my-tech-blog-rss-feed/feeds/delivery/index.json?deployment=${sha}&t=${Date.now()}`, { signal: AbortSignal.timeout(10000) });
          if (response.ok) {
            const published = await response.json();
            if (published.schemaVersion === 2 && published.updatedAt === expected.updatedAt &&
              JSON.stringify(published.feeds) === JSON.stringify(expected.feeds)) {
              core.info(`Pages公開と実URLへの反映を確認しました: ${url}`);
              return;
            }
          }
        } catch { core.info('公開先への反映を待っています。'); }
      } else if (run.status === 'completed' && run.run_attempt !== retriedAttempt) {
        if (retries >= 2) throw new Error(`Pages公開が再試行後も失敗しています: ${url}`);
        await pause(15000 * (retries + 1));
        await github.rest.actions.reRunWorkflowFailedJobs({ owner, repo, run_id: run.id });
        retriedAttempt = run.run_attempt;
        retries++;
        core.warning(`Pages公開を再試行しました (${retries}/2): ${url}`);
      }
    }
    await pause(10000);
  }
  throw new Error(`Pages公開または実URLの反映を期限内に確認できませんでした: ${url || sha}`);
};
