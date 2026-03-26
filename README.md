# 🛡️ PRGuard

**AI-powered PR quality guardian — detect and block low-quality & AI slop pull requests**

[![GitHub Action](https://img.shields.io/badge/GitHub-Action-blue?logo=github)](https://github.com/1137043480/PRGuard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![中文文档](https://img.shields.io/badge/🌐-中文文档-red)](./README_CN.md)

---

> Open-source maintainers are drowning in AI-generated slop PRs. PRGuard stops them before they reach your review queue — with **zero cost** in rules mode, or deep AI analysis with your own API key.

## ✨ Features

| Feature | Rules Mode (Free) | AI Mode (BYOK) |
|---------|:-:|:-:|
| 40+ quality checks | ✅ | ✅ |
| AI slop pattern detection | ✅ | ✅ |
| Quality scoring (0-100) | ✅ | ✅ |
| **Import verification against source** | ✅ | ✅ |
| **Code style mismatch detection** | ✅ | ✅ |
| **PR history / reputation analysis** | ✅ | ✅ |
| **Cross-repo spam detection** | ✅ | ✅ |
| **Line-level AI code review** | ❌ | ✅ |
| **Import Graph context injection** | ❌ | ✅ |
| Semantic code analysis | ❌ | ✅ |
| Hallucinated API detection | Basic | Deep |
| Auto-close slop PRs | ✅ | ✅ |

### What PRGuard Checks

- **🏷️ Title** — Conventional commit format, length, blocked patterns
- **📝 Description** — Completeness, template compliance, AI filler phrase detection
- **📦 Commits** — Message quality, author matching, lazy message detection
- **🌿 Branch** — Source/target branch rules, naming convention
- **📁 Files** — Change size limits, sensitive files, excessive comments detection
- **👤 Contributor** — Account age, spam username detection, trust scoring
- **🤖 AI Slop** — Emoji overload, hallucinated imports, over-engineering signals

**V2 Advanced Detection:**
- **📦 Import Verification** — Checks imports against actual project source code (not guessing)
- **🎨 Code Style** — Detects naming convention and indent style mismatches vs project
- **📜 PR History** — Analyzes author's merge/rejection rate, flags serial rejected contributors
- **🕸️ Cross-Repo Spam** — Detects users opening PRs across 10+ repos in 24h (bot detection)

**V3 AI Code Review** (requires AI API key):
- **📝 Line-Level Review** — AI posts inline comments on specific code lines, like a human reviewer
- **🧠 Import Graph Context** — AI reads related project files (not just the diff) to catch duplicated logic, API misuse, and style inconsistencies
- **⚡ Auto Request Changes** — Automatically marks PR as "changes requested" when critical issues are found

### 📸 Example Output

When PRGuard detects a low-quality PR, it posts a detailed review comment:

```
❌ PRGuard Review — Failed

Quality Score: 57/100 🟡 Fair

⚠️ 4 issue(s) found:

🟡 Warnings (4)
- PR title does not follow conventional format. Got: "Update some files"
- PR description has too many emoji (13, max 10)
- AI slop patterns detected: "this pr aims to", "best practices",
  "comprehensive solution", "seamless integration"
- 1 commit(s) have lazy/meaningless messages: "update"

🤖 AI Analysis
This PR appears to be AI-generated filler with placeholder logic,
suspicious imports, and excessive comment noise.

Slop Indicators:
- Hallucinated imports: some_nonexistent_package
- Excessive comments restating obvious code behavior
- Generic naming (do_stuff, another_function)
- Boilerplate with no real implementation
```

**Line-level AI Code Review** (with `mode: 'ai'`):

PRGuard also posts inline comments directly on the code — just like a human reviewer:

```
src/utils/auth-helper.ts line 8:
  🔴 CRITICAL: `useAuth()` is a React hook and cannot be called from
  a regular utility function. This violates the Rules of Hooks.

src/utils/auth-helper.ts line 13:
  🟡 WARNING: `build_api_url` duplicates existing `buildApiUrl` logic
  in `src/lib/apiClient.ts` and hardcodes a base URL.

src/utils/auth-helper.ts line 17:
  🔵 NITPICK: Function naming `fetch_user_data` is inconsistent with
  the codebase's camelCase TypeScript style.
```

> The AI reads related project files via **Import Graph** — it knows your codebase, not just the diff.

## 🚀 Quick Start

### Step 1: Create a workflow file

In **your** repository, create the file `.github/workflows/pr-quality.yml`:

```
your-project/
├── src/
├── README.md
└── .github/
    └── workflows/
        └── pr-quality.yml   ← create this file
```

### Step 2: Paste this config

#### Option A: Rules Only (Free, Zero Config)

```yaml
# .github/workflows/pr-quality.yml
name: PR Quality
on:
  pull_request_target:
    types: [opened, reopened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  prguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: 1137043480/PRGuard@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          # ↑ This is auto-provided by GitHub. You do NOT need to create it.
```

**That's it!** Every PR now gets automatic quality checks. No API key needed.

---

#### Option B: Rules + AI Code Review (BYOK)

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Add your AI API key:
   - Name: `OPENAI_API_KEY` → Value: your key (e.g. `sk-...`)
   - *(Optional)* Name: `OPENAI_BASE_URL` → Value: your API endpoint

3. Update the workflow:

```yaml
# .github/workflows/pr-quality.yml
name: PR Quality
on:
  pull_request_target:
    types: [opened, reopened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  prguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: 1137043480/PRGuard@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: 'ai'
          ai-provider: 'openai'
          ai-api-key: ${{ secrets.OPENAI_API_KEY }}
          ai-base-url: ${{ secrets.OPENAI_BASE_URL }}  # optional
          ai-model: 'gpt-4o-mini'
```

> 🔒 **Your API key is safe.** It's stored in GitHub Secrets — never exposed in code, logs, or to PRGuard.

### Step 3: Done!

Next time someone opens a PR, PRGuard runs automatically within 30 seconds.

---

### Supported AI Providers

Any provider with an OpenAI-compatible `/v1/chat/completions` endpoint works. Just set `ai-provider: 'openai'` and point `ai-base-url` to your endpoint:

| Provider | `ai-base-url` | Example Model |
|----------|---------------|---------------|
| **OpenAI** | *(default, no need to set)* | `gpt-4o-mini` |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` |
| **Groq** | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| **Together AI** | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| **Mistral** | `https://api.mistral.ai/v1` | `mistral-large-latest` |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `anthropic/claude-sonnet-4-20250514` |
| **NewAPI / One API** | `https://your-server.com/v1` | any model |
| **Ollama (self-hosted)** | `http://your-server:11434/v1` | `llama3.3` |

For **Anthropic Claude** (native API, not OpenAI-compatible):
```yaml
          ai-provider: 'anthropic'
          ai-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          ai-model: 'claude-sonnet-4-20250514'
```

## ⚙️ Configuration (Optional)

All settings below are **optional** — PRGuard works out of the box with sensible defaults. Add these to your workflow only if you want to customize behavior:

```yaml
- uses: 1137043480/PRGuard@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    max-failures: 6         # ← optional: override any default below
    min-quality-score: 60
```

### Scoring

| Input | Default | Description |
|-------|---------|-------------|
| `max-failures` | `4` | How many checks can fail before PRGuard flags the PR. Increase if you want to be more lenient |
| `min-quality-score` | `40` | PR must score above this (0-100) to pass. Set higher (e.g. `70`) for stricter quality control |

### PR Title

| Input | Default | Description |
|-------|---------|-------------|
| `require-conventional-title` | `true` | Require titles like `feat: ...`, `fix: ...`, `docs: ...`. Set `false` if your project doesn't use conventional commits |
| `blocked-title-patterns` | `Update README.md,...` | Auto-generated titles that indicate low effort. PRs with these titles are flagged |

### PR Description

| Input | Default | Description |
|-------|---------|-------------|
| `require-description` | `true` | Require PR body to not be empty. Set `false` for small/trivial projects |
| `min-description-length` | `30` | Minimum characters in PR body. Short descriptions often mean low-effort PRs |
| `max-description-length` | `5000` | Flag overly long descriptions — a common sign of AI-generated slop |
| `max-emoji-count` | `10` | Flag descriptions with too many emoji — another AI slop signal |

### Commits

| Input | Default | Description |
|-------|---------|-------------|
| `require-conventional-commits` | `false` | Require each commit message to follow `type: message` format. Default off since many projects don't enforce this |
| `require-commit-author-match` | `true` | Commit author email must match the PR author. Catches copied/stolen commits |

### Files

| Input | Default | Description |
|-------|---------|-------------|
| `max-files-changed` | `50` | Flag PRs that touch too many files. Large PRs are often AI-generated bulk changes |
| `max-additions` | `2000` | Flag PRs that add too many lines. Giant code dumps are a slop signal |
| `detect-excessive-comments` | `true` | Detect AI-style comments like `// Initialize the variable` on `let x = 0` |
| `detect-hallucinated-imports` | `true` | Check if imported packages actually exist. AI often invents fake package names |

### Contributor

| Input | Default | Description |
|-------|---------|-------------|
| `min-account-age-days` | `7` | Flag accounts created less than 7 days ago. Fresh accounts are often spam bots |
| `detect-spam-usernames` | `true` | Flag random-looking usernames like `xjk283hd` — typical of bot accounts |

### Actions — What PRGuard does when a PR fails

| Input | Default | Description |
|-------|---------|-------------|
| `close-pr` | `false` | Automatically close failing PRs. **Use with caution** — only enable if you get heavy spam |
| `add-label` | `needs-review` | Label added to failing PRs so you can filter them in GitHub |
| `comment-on-pr` | `true` | Post a detailed review comment with score and issues. Set `false` to run silently |

### Exemptions — Who skips PRGuard checks

| Input | Default | Description |
|-------|---------|-------------|
| `exempt-bots` | `true` | Skip Dependabot, Renovate, and other known bots |
| `exempt-draft-prs` | `true` | Skip draft PRs (still work-in-progress) |
| `exempt-users` | `` | Skip specific users, e.g. `user1,user2` (comma-separated) |
| `exempt-labels` | `` | Skip PRs with certain labels, e.g. `skip-review,trusted` |

> **Note:** Repository Owners, Members, and Collaborators are **automatically exempt** — no configuration needed.

## 📊 Outputs

| Output | Description |
|--------|-------------|
| `quality-score` | Overall quality score (0-100) |
| `passed` | Whether the PR passed |
| `failures` | Number of failed checks |
| `report` | Full JSON report |

In addition, PRGuard posts:
- **📋 Summary comment** — Quality score, rule violations, AI analysis (on every PR)
- **📝 Inline review comments** — Line-level feedback on specific code issues (AI mode only)
- **🏷️ Labels** — Adds configurable labels on failing PRs
- **🔄 Request Changes** — Marks PR as "changes requested" when critical issues are found (AI mode only)

## 🆚 PRGuard vs Alternatives

| Feature | PRGuard | anti-slop | PR-Agent | CodeRabbit |
|---------|---------|-----------|----------|------------|
| Rule checks | 40+ | 31 | ❌ | ❌ |
| Line-level AI review | ✅ (BYOK) | ❌ | ✅ | ✅ |
| Import Graph context | ✅ | ❌ | ❌ | ✅ |
| AI slop detection | ✅ Deep | ✅ Basic | ❌ | ❌ |
| Import verification | ✅ 6 languages | ❌ | ❌ | ❌ |
| Quality scoring | ✅ 0-100 | ❌ | ❌ | ❌ |
| Self-hosted AI (Ollama) | ✅ | ❌ | ❌ | ❌ |
| Zero-cost mode | ✅ | ✅ | ❌ | ❌ |
| License | MIT | MIT | Apache | Closed |

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT © [1137043480](https://github.com/1137043480)
