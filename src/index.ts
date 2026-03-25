import * as core from '@actions/core';
import * as github from '@actions/github';
import { buildConfig } from './config/schema';
import { PRData, CommitData, FileData, CheckResult } from './config/types';
import { checkTitle } from './checks/title';
import { checkDescription } from './checks/description';
import { checkCommits } from './checks/commits';
import { checkBranch } from './checks/branch';
import { checkFiles } from './checks/files';
import { checkContributor } from './checks/contributor';
import { checkImports } from './checks/import-verifier';
import { checkCodeStyle } from './checks/style-checker';
import { checkPRHistory } from './checks/pr-history';
import { checkMultiPR } from './checks/multi-pr-detector';
import { calculateScore } from './scoring/scorer';
import { createAIProvider } from './ai/analyzer';
import { postReviewComment } from './reporter/github-comment';

async function run(): Promise<void> {
  try {
    core.info('🛡️ PRGuard — AI-powered PR quality guardian');

    // Parse configuration
    const config = buildConfig((name) => core.getInput(name));
    core.info(`Mode: ${config.mode}`);

    // Validate context
    const context = github.context;
    if (!context.payload.pull_request) {
      core.setFailed('This action can only be run on pull_request events');
      return;
    }

    const pr = context.payload.pull_request;
    const octokit = github.getOctokit(config.githubToken);
    const { owner, repo } = context.repo;
    const prNumber = pr.number;

    // Check exemptions
    if (config.exemptDraftPrs && pr.draft) {
      core.info('⏭️ Skipping: PR is a draft');
      setOutputs(100, true, 0);
      return;
    }

    if (config.exemptBots && pr.user.type === 'Bot') {
      core.info('⏭️ Skipping: PR author is a bot');
      setOutputs(100, true, 0);
      return;
    }

    if (config.exemptUsers.includes(pr.user.login)) {
      core.info(`⏭️ Skipping: user "${pr.user.login}" is exempt`);
      setOutputs(100, true, 0);
      return;
    }

    const prLabels: string[] = (pr.labels || []).map((l: { name: string }) => l.name);
    if (config.exemptLabels.some(el => prLabels.includes(el))) {
      core.info('⏭️ Skipping: PR has exempt label');
      setOutputs(100, true, 0);
      return;
    }

    // Auto-exempt owners/members/collaborators (unless disabled for testing)
    const disableAutoExempt = core.getInput('disable-auto-exempt') === 'true';
    if (!disableAutoExempt) {
      const trustedAssociations = ['OWNER', 'MEMBER', 'COLLABORATOR'];
      if (trustedAssociations.includes(pr.author_association)) {
        core.info(`⏭️ Skipping: PR author is ${pr.author_association}`);
        setOutputs(100, true, 0);
        return;
      }
    } else {
      core.info('🔧 Auto-exempt disabled (testing mode)');
    }

    // Fetch PR data
    core.info('📊 Fetching PR data...');
    const prData = await fetchPRData(octokit, owner, repo, prNumber, pr);

    // Run all rule checks
    core.info('🔍 Running rule checks...');
    const results: CheckResult[] = [
      ...checkTitle(prData, config),
      ...checkDescription(prData, config),
      ...checkCommits(prData, config),
      ...checkBranch(prData, config),
      ...checkFiles(prData, config),
      ...checkContributor(prData, config),
    ];

    core.info(`📋 Rule checks complete: ${results.length} checks, ${results.filter(r => !r.passed).length} failed`);

    // V2: Advanced checks
    const workspacePath = process.env.GITHUB_WORKSPACE;
    if (workspacePath) {
      core.info('🔬 Running advanced checks (V2)...');

      // Import verification (checkout required)
      if (core.getInput('verify-imports') !== 'false') {
        const importResults = checkImports(prData, config, workspacePath);
        results.push(...importResults);
        core.info(`  📦 Import verification: ${importResults.length} checks`);
      }

      // Code style comparison
      if (core.getInput('check-code-style') !== 'false') {
        const styleResults = checkCodeStyle(prData, config, workspacePath);
        results.push(...styleResults);
        core.info(`  🎨 Code style: ${styleResults.length} checks`);
      }
    }

    // PR history analysis
    if (core.getInput('check-pr-history') !== 'false') {
      core.info('  📜 Analyzing PR history...');
      const historyResults = await checkPRHistory(prData, config.githubToken, owner, repo);
      results.push(...historyResults);
    }

    // Multi-PR correlation detection
    if (core.getInput('check-multi-pr') !== 'false') {
      core.info('  🕸️ Checking cross-repo PR activity...');
      const maxRepos = parseInt(core.getInput('max-repos-per-day') || '10');
      const multiResults = await checkMultiPR(prData, config.githubToken, maxRepos);
      results.push(...multiResults);
    }

    core.info(`📋 All checks complete: ${results.length} total, ${results.filter(r => !r.passed).length} failed`);

    // Run AI analysis if configured
    let aiAnalysis;
    if (config.mode === 'ai' && config.ai.apiKey) {
      core.info('🤖 Running AI analysis...');
      try {
        const provider = createAIProvider(config);
        const diff = await fetchDiff(octokit, owner, repo, prNumber);
        aiAnalysis = await provider.analyze(prData, diff);
        core.info('🤖 AI analysis complete');
      } catch (error) {
        core.warning(`AI analysis failed (continuing with rules only): ${error}`);
      }
    }

    // Calculate final score
    const report = calculateScore(results, aiAnalysis);

    // Determine pass/fail
    report.passed = report.failedChecks <= config.maxFailures &&
                    report.qualityScore >= config.minQualityScore;

    core.info(`\n${'='.repeat(50)}`);
    core.info(`Quality Score: ${report.qualityScore}/100`);
    core.info(`Status: ${report.passed ? '✅ PASSED' : '❌ FAILED'}`);
    core.info(`Checks: ${report.totalChecks} total, ${report.failedChecks} failed`);
    core.info(`${'='.repeat(50)}\n`);

    // Set outputs
    setOutputs(report.qualityScore, report.passed, report.failedChecks);
    core.setOutput('report', JSON.stringify(report));

    // Post comment
    if (config.commentOnPr) {
      core.info('💬 Posting review comment...');
      await postReviewComment(
        config.githubToken,
        report,
        config.closePr,
        config.addLabel,
      );
    }

    // Set action status
    if (!report.passed) {
      core.setFailed(
        `PR quality check failed (score: ${report.qualityScore}/100, ` +
        `${report.failedChecks} failures, max allowed: ${config.maxFailures})`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`PRGuard error: ${error.message}`);
    } else {
      core.setFailed('PRGuard encountered an unknown error');
    }
  }
}

// Fetch full PR data from GitHub API
async function fetchPRData(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prPayload: any,
): Promise<PRData> {
  // Fetch commits
  const { data: commits } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  // Fetch files
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  // Fetch author details
  let authorCreatedAt = prPayload.user.created_at || new Date().toISOString();
  try {
    const { data: user } = await octokit.rest.users.getByUsername({
      username: prPayload.user.login,
    });
    authorCreatedAt = user.created_at;
  } catch {
    // Use payload data if user fetch fails
  }

  const commitData: CommitData[] = commits.map(c => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.author?.login || c.commit.author?.name || 'unknown',
    email: c.commit.author?.email || '',
  }));

  const fileData: FileData[] = files.map(f => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));

  return {
    number: prNumber,
    title: prPayload.title,
    body: prPayload.body,
    author: prPayload.user.login,
    authorCreatedAt,
    authorAssociation: prPayload.author_association,
    isDraft: prPayload.draft || false,
    labels: (prPayload.labels || []).map((l: { name: string }) => l.name),
    sourceBranch: prPayload.head.ref,
    targetBranch: prPayload.base.ref,
    commits: commitData,
    files: fileData,
    additions: prPayload.additions || 0,
    deletions: prPayload.deletions || 0,
    changedFiles: prPayload.changed_files || files.length,
  };
}

// Fetch PR diff for AI analysis
async function fetchDiff(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<string> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: 'diff' },
  });

  return data as unknown as string;
}

function setOutputs(score: number, passed: boolean, failures: number): void {
  core.setOutput('quality-score', score.toString());
  core.setOutput('passed', passed.toString());
  core.setOutput('failures', failures.toString());
}

run();
