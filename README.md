# 🛡️ PRGuard

**AI-powered PR quality guardian — detect and block low-quality & AI slop pull requests**

[![GitHub Action](https://img.shields.io/badge/GitHub-Action-blue?logo=github)](https://github.com/1137043480/prguard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![中文文档](https://img.shields.io/badge/🌐-中文文档-red)](./README_CN.md)

---

> Open-source maintainers are drowning in AI-generated slop PRs. PRGuard stops them before they reach your review queue — with **zero cost** in rules mode, or deep AI analysis with your own API key.

## ✨ Features

| Feature | Rules Mode (Free) | AI Mode (BYOK) |
|---------|:-:|:-:|
| 30+ quality checks | ✅ | ✅ |
| AI slop pattern detection | ✅ | ✅ |
| Quality scoring (0-100) | ✅ | ✅ |
| Semantic code analysis | ❌ | ✅ |
| Hallucinated API detection | Basic | Deep |
| Project convention learning | ❌ | ✅ |
| Auto-close slop PRs | ✅ | ✅ |

### What PRGuard Checks

- **🏷️ Title** — Conventional commit format, length, blocked patterns
- **📝 Description** — Completeness, template compliance, AI filler phrase detection
- **📦 Commits** — Message quality, author matching, lazy message detection
- **🌿 Branch** — Source/target branch rules, naming convention
- **📁 Files** — Change size limits, sensitive files, excessive comments detection
- **👤 Contributor** — Account age, spam username detection, trust scoring
- **🤖 AI Slop** — Emoji overload, hallucinated imports, over-engineering signals

## 🚀 Quick Start

### Rules Only (Zero Cost, Zero Config)

```yaml
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
      - uses: 1137043480/prguard@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Rules + AI Analysis (BYOK)

```yaml
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
      - uses: 1137043480/prguard@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: 'ai'
          ai-provider: 'openai'
          ai-api-key: ${{ secrets.OPENAI_API_KEY }}
          ai-model: 'gpt-4o-mini'
```

### Using Ollama (Self-hosted, Free)

```yaml
      - uses: 1137043480/prguard@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: 'ai'
          ai-provider: 'ollama'
          ai-base-url: 'http://your-server:11434/v1'
          ai-model: 'llama3'
```

## ⚙️ Configuration

### Scoring

| Input | Default | Description |
|-------|---------|-------------|
| `max-failures` | `4` | Max check failures before action is taken |
| `min-quality-score` | `40` | Minimum score (0-100) to pass |

### PR Title

| Input | Default | Description |
|-------|---------|-------------|
| `require-conventional-title` | `true` | Require conventional commit style |
| `blocked-title-patterns` | `Update README.md,...` | Blocked title patterns (regex) |

### PR Description

| Input | Default | Description |
|-------|---------|-------------|
| `require-description` | `true` | Require PR description |
| `min-description-length` | `30` | Minimum description length |
| `max-description-length` | `5000` | Max length (slop signal) |
| `max-emoji-count` | `10` | Max emoji in description |

### Commits

| Input | Default | Description |
|-------|---------|-------------|
| `require-conventional-commits` | `false` | Require conventional commits |
| `require-commit-author-match` | `true` | Commit author must match PR author |

### Files

| Input | Default | Description |
|-------|---------|-------------|
| `max-files-changed` | `50` | Max files changed |
| `max-additions` | `2000` | Max lines added |
| `detect-excessive-comments` | `true` | Detect AI-typical comment patterns |
| `detect-hallucinated-imports` | `true` | Detect non-existent packages |

### Contributor

| Input | Default | Description |
|-------|---------|-------------|
| `min-account-age-days` | `7` | Minimum account age |
| `detect-spam-usernames` | `true` | Detect random/bot usernames |

### Actions

| Input | Default | Description |
|-------|---------|-------------|
| `close-pr` | `false` | Auto-close failing PRs |
| `add-label` | `needs-review` | Label to add on failure |
| `comment-on-pr` | `true` | Post review comment |

### Exemptions

| Input | Default | Description |
|-------|---------|-------------|
| `exempt-bots` | `true` | Exempt bot accounts |
| `exempt-draft-prs` | `true` | Exempt draft PRs |
| `exempt-users` | `` | Comma-separated exempt users |
| `exempt-labels` | `` | Exempt PR labels |

> **Note:** Owners, Members, and Collaborators are **automatically exempt** — no configuration needed.

## 📊 Outputs

| Output | Description |
|--------|-------------|
| `quality-score` | Overall quality score (0-100) |
| `passed` | Whether the PR passed |
| `failures` | Number of failed checks |
| `report` | Full JSON report |

## 🆚 PRGuard vs Alternatives

| Feature | PRGuard | anti-slop | PR-Agent | CodeRabbit |
|---------|---------|-----------|----------|------------|
| Rule checks | 30+ | 31 | ❌ | ❌ |
| AI semantic analysis | ✅ (BYOK) | ❌ | ✅ | ✅ |
| AI slop detection | ✅ Deep | ✅ Basic | ❌ | ❌ |
| Quality scoring | ✅ 0-100 | ❌ | ❌ | ❌ |
| Self-hosted AI (Ollama) | ✅ | ❌ | ❌ | ❌ |
| Zero-cost mode | ✅ | ✅ | ❌ | ❌ |
| License | MIT | MIT | Apache | Closed |

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT © [1137043480](https://github.com/1137043480)
