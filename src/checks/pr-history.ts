import * as github from '@actions/github';
import { CheckResult, PRData } from '../config/types';

export async function checkPRHistory(
  pr: PRData,
  token: string,
  owner: string,
  repo: string,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const octokit = github.getOctokit(token);

  try {
    // Fetch all PRs from this author on this repo
    const { data: authorPRs } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'all',
      per_page: 100,
      sort: 'created',
      direction: 'desc',
    });

    // Filter to this author's PRs (excluding current)
    const myPRs = authorPRs.filter(
      p => p.user?.login === pr.author && p.number !== pr.number
    );

    if (myPRs.length === 0) {
      results.push({
        name: 'history-first-time',
        passed: true, // Not a fail, just informational
        message: `⚡ First-time contributor to this repository`,
        severity: 'info',
        category: 'contributor',
        score: 50, // Neutral score — no history to judge
      });
      return results;
    }

    // Calculate merge rate
    const merged = myPRs.filter(p => p.merged_at !== null);
    const closed = myPRs.filter(p => p.state === 'closed' && p.merged_at === null);
    const mergeRate = merged.length / myPRs.length;
    const rejectionRate = closed.length / myPRs.length;

    results.push({
      name: 'history-merge-rate',
      passed: mergeRate >= 0.3, // At least 30% of PRs merged
      message: mergeRate >= 0.3
        ? `Contributor has ${Math.round(mergeRate * 100)}% merge rate (${merged.length}/${myPRs.length} PRs merged)`
        : `⚠️ Contributor has low merge rate: ${Math.round(mergeRate * 100)}% (${merged.length}/${myPRs.length} PRs merged, ${closed.length} rejected)`,
      severity: mergeRate >= 0.3 ? 'info' : 'warning',
      category: 'contributor',
      score: Math.round(Math.max(20, mergeRate * 100)),
    });

    // Flag serial rejected contributors
    if (rejectionRate > 0.7 && myPRs.length >= 3) {
      results.push({
        name: 'history-serial-rejected',
        passed: false,
        message: `🚩 ${Math.round(rejectionRate * 100)}% of this contributor's PRs were rejected (${closed.length}/${myPRs.length}) — possible spam/slop pattern`,
        severity: 'warning',
        category: 'slop-pattern',
        score: 10,
      });
    }

    // Reward active contributors
    if (merged.length >= 5) {
      results.push({
        name: 'history-active-contributor',
        passed: true,
        message: `✅ Active contributor with ${merged.length} merged PRs — high trust`,
        severity: 'info',
        category: 'contributor',
        score: 100,
      });
    }
  } catch {
    // API error — skip silently
  }

  return results;
}
