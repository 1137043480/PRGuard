import * as github from '@actions/github';
import { CheckResult, PRData } from '../config/types';

export async function checkMultiPR(
  pr: PRData,
  token: string,
  maxReposPerDay: number = 10,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const octokit = github.getOctokit(token);

  try {
    // Search for PRs created by this user in the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data } = await octokit.rest.search.issuesAndPullRequests({
      q: `author:${pr.author} type:pr created:>=${since}`,
      per_page: 100,
      sort: 'created',
    });

    const totalPRs = data.total_count;

    // Extract unique repos from results
    const uniqueRepos = new Set<string>();
    for (const item of data.items) {
      // Extract repo from repository_url
      const repoUrl = item.repository_url || '';
      uniqueRepos.add(repoUrl);
    }

    const repoCount = uniqueRepos.size;

    if (repoCount > maxReposPerDay) {
      results.push({
        name: 'multi-pr-spam-detected',
        passed: false,
        message: `🚨 User "${pr.author}" opened ${totalPRs} PRs across ${repoCount} repos in the last 24h (threshold: ${maxReposPerDay}) — strong bot/spam signal`,
        severity: 'error',
        category: 'slop-pattern',
        score: 0,
      });
    } else if (totalPRs > 20) {
      results.push({
        name: 'multi-pr-high-volume',
        passed: false,
        message: `⚠️ User "${pr.author}" opened ${totalPRs} PRs in the last 24h — unusually high volume`,
        severity: 'warning',
        category: 'slop-pattern',
        score: 20,
      });
    } else if (totalPRs > 5 && repoCount > 3) {
      results.push({
        name: 'multi-pr-moderate',
        passed: true,
        message: `User opened ${totalPRs} PRs across ${repoCount} repos in 24h — moderate activity`,
        severity: 'info',
        category: 'contributor',
        score: 70,
      });
    }
  } catch {
    // Search API might be rate-limited — skip silently
  }

  return results;
}
