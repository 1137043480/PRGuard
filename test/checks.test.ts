import { describe, it, expect } from 'vitest';
import { checkTitle } from '../src/checks/title';
import { checkDescription } from '../src/checks/description';
import { checkCommits } from '../src/checks/commits';
import { checkBranch } from '../src/checks/branch';
import { checkFiles } from '../src/checks/files';
import { checkContributor } from '../src/checks/contributor';
import { calculateScore } from '../src/scoring/scorer';
import { Config } from '../src/config/schema';
import { PRData, CheckResult } from '../src/config/types';

// Default test config
function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    githubToken: 'test-token',
    mode: 'rules',
    requireConventionalTitle: true,
    blockedTitlePatterns: ['Update README.md', 'Minor fixes'],
    requireDescription: true,
    minDescriptionLength: 30,
    maxDescriptionLength: 5000,
    requirePrTemplate: false,
    requireConventionalCommits: false,
    maxCommitMessageLength: 200,
    requireCommitAuthorMatch: true,
    blockedSourceBranches: ['main', 'master'],
    allowedTargetBranches: [],
    blockedFilePatterns: [],
    maxFilesChanged: 50,
    maxAdditions: 2000,
    minAccountAgeDays: 7,
    detectSpamUsernames: true,
    detectExcessiveComments: true,
    detectHallucinatedImports: true,
    maxEmojiCount: 10,
    closePr: false,
    addLabel: 'needs-review',
    commentOnPr: true,
    exemptUsers: [],
    exemptBots: true,
    exemptDraftPrs: true,
    exemptLabels: [],
    maxFailures: 4,
    minQualityScore: 40,
    ai: { provider: 'openai', model: 'gpt-4o-mini' },
    ...overrides,
  } as Config;
}

// Default test PR data
function makePR(overrides: Partial<PRData> = {}): PRData {
  return {
    number: 1,
    title: 'feat: add user authentication',
    body: 'This PR adds JWT-based authentication to the API. It includes login, registration, and token refresh endpoints.',
    author: 'testuser',
    authorCreatedAt: '2020-01-01T00:00:00Z',
    authorAssociation: 'NONE',
    isDraft: false,
    labels: [],
    sourceBranch: 'feat/auth',
    targetBranch: 'main',
    commits: [
      { sha: 'abc123', message: 'feat: add auth middleware', author: 'testuser', email: 'test@test.com' },
    ],
    files: [
      { filename: 'src/auth.ts', status: 'added', additions: 50, deletions: 0, patch: '+import jwt from "jsonwebtoken";\n+export function verify() {}' },
    ],
    additions: 50,
    deletions: 0,
    changedFiles: 1,
    ...overrides,
  };
}

// ==========================================
// Title Checks
// ==========================================
describe('Title Checks', () => {
  it('passes conventional title', () => {
    const results = checkTitle(makePR({ title: 'feat: add login page' }), makeConfig());
    const conv = results.find(r => r.name === 'title-conventional');
    expect(conv?.passed).toBe(true);
  });

  it('fails non-conventional title', () => {
    const results = checkTitle(makePR({ title: 'Add some stuff' }), makeConfig());
    const conv = results.find(r => r.name === 'title-conventional');
    expect(conv?.passed).toBe(false);
  });

  it('detects short title', () => {
    const results = checkTitle(makePR({ title: 'fix bug' }), makeConfig());
    const length = results.find(r => r.name === 'title-length');
    expect(length?.passed).toBe(false);
  });

  it('detects blocked title pattern', () => {
    const results = checkTitle(makePR({ title: 'Update README.md' }), makeConfig());
    const blocked = results.find(r => r.name === 'title-blocked-pattern');
    expect(blocked?.passed).toBe(false);
  });

  it('detects all-caps title', () => {
    const results = checkTitle(makePR({ title: 'UPDATE ALL THE THINGS NOW' }), makeConfig());
    const caps = results.find(r => r.name === 'title-all-caps');
    expect(caps?.passed).toBe(false);
  });

  it('accepts scoped conventional title', () => {
    const results = checkTitle(makePR({ title: 'fix(auth): resolve token issue' }), makeConfig());
    const conv = results.find(r => r.name === 'title-conventional');
    expect(conv?.passed).toBe(true);
  });
});

// ==========================================
// Description Checks
// ==========================================
describe('Description Checks', () => {
  it('fails on missing description', () => {
    const results = checkDescription(makePR({ body: '' }), makeConfig());
    const exists = results.find(r => r.name === 'description-exists');
    expect(exists?.passed).toBe(false);
  });

  it('passes with good description', () => {
    const results = checkDescription(makePR(), makeConfig());
    const exists = results.find(r => r.name === 'description-exists');
    expect(exists?.passed).toBe(true);
  });

  it('detects too-short description', () => {
    const results = checkDescription(makePR({ body: 'Fixed a bug.' }), makeConfig());
    const short = results.find(r => r.name === 'description-too-short');
    expect(short?.passed).toBe(false);
  });

  it('detects AI slop filler phrases', () => {
    const slopBody = 'This PR aims to improve overall maintainability and readability. It provides a comprehensive solution that ensures consistency and follows best practices. The seamless integration creates a robust implementation.';
    const results = checkDescription(makePR({ body: slopBody }), makeConfig());
    const slop = results.find(r => r.name === 'description-ai-slop-patterns');
    expect(slop?.passed).toBe(false);
    expect(slop?.category).toBe('slop-pattern');
  });

  it('detects emoji overload', () => {
    const emojiBody = 'Great PR! 🎉🎉🎉🚀🚀🚀🔥🔥🔥💯💯💯 awesome work!';
    const results = checkDescription(makePR({ body: emojiBody }), makeConfig());
    const emoji = results.find(r => r.name === 'description-emoji-overload');
    expect(emoji?.passed).toBe(false);
  });

  it('detects empty template', () => {
    const templateBody = '## Description\n## Changes\n## Screenshots';
    const results = checkDescription(makePR({ body: templateBody }), makeConfig());
    const empty = results.find(r => r.name === 'description-empty-template');
    expect(empty?.passed).toBe(false);
  });
});

// ==========================================
// Commit Checks
// ==========================================
describe('Commit Checks', () => {
  it('detects lazy commit messages', () => {
    const pr = makePR({
      commits: [{ sha: 'a', message: 'update', author: 'testuser', email: '' }],
    });
    const results = checkCommits(pr, makeConfig());
    const lazy = results.find(r => r.name === 'commits-lazy-messages');
    expect(lazy?.passed).toBe(false);
  });

  it('detects author mismatch', () => {
    const pr = makePR({
      commits: [{ sha: 'a', message: 'feat: stuff', author: 'otheruser', email: '' }],
    });
    const results = checkCommits(pr, makeConfig());
    const mismatch = results.find(r => r.name === 'commits-author-match');
    expect(mismatch?.passed).toBe(false);
  });

  it('passes good commits', () => {
    const results = checkCommits(makePR(), makeConfig());
    const lazy = results.find(r => r.name === 'commits-lazy-messages');
    expect(lazy).toBeUndefined(); // no lazy messages = no result for this check
  });

  it('detects single mega-commit', () => {
    const pr = makePR({
      commits: [{ sha: 'a', message: 'feat: all changes', author: 'testuser', email: '' }],
      additions: 600,
    });
    const results = checkCommits(pr, makeConfig());
    const mega = results.find(r => r.name === 'commits-single-mega');
    expect(mega?.passed).toBe(false);
  });

  it('validates conventional commits when enabled', () => {
    const config = makeConfig({ requireConventionalCommits: true });
    const pr = makePR({
      commits: [{ sha: 'a', message: 'just some changes', author: 'testuser', email: '' }],
    });
    const results = checkCommits(pr, config);
    const conv = results.find(r => r.name === 'commits-conventional');
    expect(conv?.passed).toBe(false);
  });
});

// ==========================================
// Branch Checks
// ==========================================
describe('Branch Checks', () => {
  it('blocks PRs from main branch', () => {
    const pr = makePR({ sourceBranch: 'main' });
    const results = checkBranch(pr, makeConfig());
    const blocked = results.find(r => r.name === 'branch-source-blocked');
    expect(blocked?.passed).toBe(false);
  });

  it('allows feature branches', () => {
    const results = checkBranch(makePR(), makeConfig());
    const blocked = results.find(r => r.name === 'branch-source-blocked');
    expect(blocked?.passed).toBe(true);
  });

  it('validates target branch when configured', () => {
    const config = makeConfig({ allowedTargetBranches: ['main', 'develop'] });
    const pr = makePR({ targetBranch: 'staging' });
    const results = checkBranch(pr, config);
    const target = results.find(r => r.name === 'branch-target-allowed');
    expect(target?.passed).toBe(false);
  });
});

// ==========================================
// File Checks
// ==========================================
describe('File Checks', () => {
  it('detects too many files changed', () => {
    const pr = makePR({ changedFiles: 60 });
    const results = checkFiles(pr, makeConfig());
    const many = results.find(r => r.name === 'files-too-many');
    expect(many?.passed).toBe(false);
  });

  it('detects suspicious files', () => {
    const pr = makePR({
      files: [{ filename: '.env', status: 'added', additions: 5, deletions: 0 }],
    });
    const results = checkFiles(pr, makeConfig());
    const suspicious = results.find(r => r.name === 'files-suspicious');
    expect(suspicious?.passed).toBe(false);
  });

  it('detects slop-only file changes', () => {
    const pr = makePR({
      files: [
        { filename: 'README.md', status: 'modified', additions: 5, deletions: 0 },
      ],
    });
    const results = checkFiles(pr, makeConfig());
    const slop = results.find(r => r.name === 'files-only-slop-targets');
    expect(slop?.passed).toBe(false);
  });

  it('passes normal file changes', () => {
    const results = checkFiles(makePR(), makeConfig());
    const many = results.find(r => r.name === 'files-too-many');
    expect(many).toBeUndefined();
  });
});

// ==========================================
// Contributor Checks
// ==========================================
describe('Contributor Checks', () => {
  it('detects new account', () => {
    const pr = makePR({ authorCreatedAt: new Date().toISOString() });
    const results = checkContributor(pr, makeConfig());
    const age = results.find(r => r.name === 'contributor-account-age');
    expect(age?.passed).toBe(false);
  });

  it('passes old account', () => {
    const results = checkContributor(makePR(), makeConfig());
    const age = results.find(r => r.name === 'contributor-account-age');
    expect(age?.passed).toBe(true);
  });

  it('detects spam username', () => {
    const pr = makePR({ author: 'a8k2x9q4r1z' });
    const results = checkContributor(pr, makeConfig());
    const spam = results.find(r => r.name === 'contributor-spam-username');
    expect(spam?.passed).toBe(false);
  });

  it('trusts repo owners', () => {
    const pr = makePR({ authorAssociation: 'OWNER' });
    const results = checkContributor(pr, makeConfig());
    const trusted = results.find(r => r.name === 'contributor-trusted');
    expect(trusted?.passed).toBe(true);
  });
});

// ==========================================
// Scoring Engine
// ==========================================
describe('Scoring Engine', () => {
  it('gives 100 for all passed checks', () => {
    const results: CheckResult[] = [
      { name: 'test-1', passed: true, message: 'ok', severity: 'info', category: 'title', score: 100 },
      { name: 'test-2', passed: true, message: 'ok', severity: 'info', category: 'description', score: 100 },
    ];
    const report = calculateScore(results);
    expect(report.qualityScore).toBe(100);
    expect(report.failedChecks).toBe(0);
  });

  it('gives low score for all failed checks', () => {
    const results: CheckResult[] = [
      { name: 'test-1', passed: false, message: 'bad', severity: 'error', category: 'title', score: 0 },
      { name: 'test-2', passed: false, message: 'bad', severity: 'error', category: 'description', score: 0 },
      { name: 'test-3', passed: false, message: 'bad', severity: 'error', category: 'slop-pattern', score: 0 },
    ];
    const report = calculateScore(results);
    expect(report.qualityScore).toBeLessThan(20);
    expect(report.failedChecks).toBe(3);
  });

  it('returns 100 for empty results', () => {
    const report = calculateScore([]);
    expect(report.qualityScore).toBe(100);
  });

  it('generates readable summary', () => {
    const results: CheckResult[] = [
      { name: 'test-1', passed: false, message: 'Title bad', severity: 'warning', category: 'title', score: 30 },
    ];
    const report = calculateScore(results);
    expect(report.summary).toContain('Quality Score');
    expect(report.summary).toContain('issue(s) found');
  });
});

// ==========================================
// Integration: Full Slop PR Detection
// ==========================================
describe('Integration: Full Slop PR', () => {
  it('detects a typical AI slop PR', () => {
    const config = makeConfig();
    const slopPR = makePR({
      title: 'Update some files',
      body: 'This PR aims to improve the overall maintainability and readability. This comprehensive solution ensures consistency and follows best practices. The seamless integration with robust implementation leverages the power of state-of-the-art technology. 🎉🎉🎉🚀🚀🚀🔥🔥🔥💯💯💯🥳',
      author: 'user1234567890',
      authorCreatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days old
      sourceBranch: 'main',
      commits: [{ sha: 'a', message: 'update', author: 'user1234567890', email: '' }],
      files: [{ filename: 'README.md', status: 'modified', additions: 5, deletions: 0 }],
    });

    const results = [
      ...checkTitle(slopPR, config),
      ...checkDescription(slopPR, config),
      ...checkCommits(slopPR, config),
      ...checkBranch(slopPR, config),
      ...checkFiles(slopPR, config),
      ...checkContributor(slopPR, config),
    ];

    const failures = results.filter(r => !r.passed);
    expect(failures.length).toBeGreaterThanOrEqual(5); // Multiple slop signals

    const report = calculateScore(results);
    expect(report.qualityScore).toBeLessThan(55); // Clear fail
  });

  it('passes a high-quality PR', () => {
    const config = makeConfig();
    const goodPR = makePR(); // Default PR is good

    const results = [
      ...checkTitle(goodPR, config),
      ...checkDescription(goodPR, config),
      ...checkCommits(goodPR, config),
      ...checkBranch(goodPR, config),
      ...checkFiles(goodPR, config),
      ...checkContributor(goodPR, config),
    ];

    const failures = results.filter(r => !r.passed);
    expect(failures.length).toBeLessThanOrEqual(1);

    const report = calculateScore(results);
    expect(report.qualityScore).toBeGreaterThan(70);
  });
});
