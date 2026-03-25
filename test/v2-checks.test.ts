import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { checkImports } from '../src/checks/import-verifier';
import { checkCodeStyle } from '../src/checks/style-checker';
import { Config } from '../src/config/schema';
import { PRData } from '../src/config/types';

// Reuse helpers
function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    githubToken: 'test-token',
    mode: 'rules',
    requireConventionalTitle: true,
    blockedTitlePatterns: [],
    requireDescription: true,
    minDescriptionLength: 30,
    maxDescriptionLength: 5000,
    requirePrTemplate: false,
    requireConventionalCommits: false,
    maxCommitMessageLength: 200,
    requireCommitAuthorMatch: true,
    blockedSourceBranches: ['main'],
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

function makePR(overrides: Partial<PRData> = {}): PRData {
  return {
    number: 1,
    title: 'feat: add feature',
    body: 'Detailed description of the changes made.',
    author: 'testuser',
    authorCreatedAt: '2020-01-01T00:00:00Z',
    authorAssociation: 'NONE',
    isDraft: false,
    labels: [],
    sourceBranch: 'feat/test',
    targetBranch: 'main',
    commits: [{ sha: 'abc', message: 'feat: test', author: 'testuser', email: '' }],
    files: [],
    additions: 10,
    deletions: 0,
    changedFiles: 1,
    ...overrides,
  };
}

// ==========================================
// Import Verifier Tests
// ==========================================
describe('Import Verifier', () => {
  it('returns empty when no workspace', () => {
    const pr = makePR({
      files: [{ filename: 'test.ts', status: 'added', additions: 1, deletions: 0, patch: '+import foo from "bar"' }],
    });
    const results = checkImports(pr, makeConfig());
    expect(results.length).toBe(0);
  });

  it('returns empty when no imports in diff', () => {
    const pr = makePR({
      files: [{ filename: 'test.ts', status: 'added', additions: 1, deletions: 0, patch: '+console.log("hello")' }],
    });
    const results = checkImports(pr, makeConfig(), '/tmp');
    expect(results.length).toBe(0);
  });

  it('detects non-existent npm package', () => {
    // Create a temp package.json
    const tmpDir = '/tmp/prguard-test-import';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { 'lodash': '^4.0.0' },
    }));

    const pr = makePR({
      files: [{
        filename: 'src/test.ts',
        status: 'added',
        additions: 2,
        deletions: 0,
        patch: '+import foo from "some_nonexistent_package"\n+import _ from "lodash"',
      }],
    });

    const results = checkImports(pr, makeConfig(), tmpDir);
    const nonExistent = results.find(r => r.name === 'imports-verified-nonexistent');
    expect(nonExistent).toBeDefined();
    expect(nonExistent?.message).toContain('some_nonexistent_package');
    expect(nonExistent?.message).not.toContain('lodash'); // lodash exists in package.json

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('allows Node built-in modules', () => {
    const tmpDir = '/tmp/prguard-test-builtins';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');

    const pr = makePR({
      files: [{
        filename: 'src/test.ts',
        status: 'added',
        additions: 2,
        deletions: 0,
        patch: '+import * as fs from "fs"\n+import * as path from "path"',
      }],
    });

    const results = checkImports(pr, makeConfig(), tmpDir);
    const verified = results.find(r => r.name === 'imports-verified');
    expect(verified?.passed).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('detects non-existent Python module', () => {
    const tmpDir = '/tmp/prguard-test-python';
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask\nrequests\n');

    const pr = makePR({
      files: [{
        filename: 'app.py',
        status: 'added',
        additions: 2,
        deletions: 0,
        patch: '+import some_fake_module\n+import flask',
      }],
    });

    const results = checkImports(pr, makeConfig(), tmpDir);
    const nonExistent = results.find(r => r.name === 'imports-verified-nonexistent');
    expect(nonExistent).toBeDefined();
    expect(nonExistent?.message).toContain('some_fake_module');

    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ==========================================
// Code Style Checker Tests
// ==========================================
describe('Code Style Checker', () => {
  it('returns empty when no workspace', () => {
    const results = checkCodeStyle(makePR(), makeConfig());
    expect(results.length).toBe(0);
  });

  it('detects naming convention mismatch', () => {
    const tmpDir = '/tmp/prguard-test-style';
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // Project uses camelCase
    fs.writeFileSync(path.join(srcDir, 'main.ts'), `
      const userName = 'test';
      const userAge = 25;
      function getUserName() { return userName; }
      function calculateTotal() { return 0; }
      const itemCount = 10;
      const isActive = true;
    `);

    // PR uses snake_case
    const pr = makePR({
      files: [{
        filename: 'src/new.ts',
        status: 'added',
        additions: 5,
        deletions: 0,
        patch: '+const user_name = "test"\n+const user_age = 25\n+function get_user_name() {}\n+const item_count = 10\n+const is_active = true',
      }],
    });

    const results = checkCodeStyle(pr, makeConfig(), tmpDir);
    const naming = results.find(r => r.name === 'style-naming-mismatch');
    expect(naming).toBeDefined();
    expect(naming?.passed).toBe(false);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('passes when style matches', () => {
    const tmpDir = '/tmp/prguard-test-style-match';
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // Project uses camelCase
    fs.writeFileSync(path.join(srcDir, 'main.ts'), `
      const userName = 'test';
      function getUserName() { return userName; }
      const itemCount = 10;
    `);

    // PR also uses camelCase
    const pr = makePR({
      files: [{
        filename: 'src/new.ts',
        status: 'added',
        additions: 5,
        deletions: 0,
        patch: '+const newUserName = "test"\n+function getNewUser() {}\n+const totalItems = 10\n+const isEnabled = true\n+function calculateResult() {}',
      }],
    });

    const results = checkCodeStyle(pr, makeConfig(), tmpDir);
    // Either consistent or no results (not enough to compare)
    const mismatch = results.find(r => r.name === 'style-naming-mismatch');
    expect(mismatch).toBeUndefined(); // No mismatch

    fs.rmSync(tmpDir, { recursive: true });
  });
});
