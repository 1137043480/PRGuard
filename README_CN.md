# 🛡️ PRGuard

**AI 驱动的 PR 质量守卫 — 自动检测和拦截低质量 & AI slop 拉取请求**

[![GitHub Action](https://img.shields.io/badge/GitHub-Action-blue?logo=github)](https://github.com/1137043480/PRGuard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![English](https://img.shields.io/badge/🌐-English-blue)](./README.md)

---

> 开源维护者正被大量 AI 生成的低质量 PR 淹没。PRGuard 在它们进入你的审查队列之前就将其拦截 — 规则模式**完全免费**，AI 模式使用你自己的 API Key。

## ✨ 功能特性

| 功能 | 规则模式 (免费) | AI 模式 (BYOK) |
|------|:-:|:-:|
| 30+ 项质量检查 | ✅ | ✅ |
| AI slop 模式检测 | ✅ | ✅ |
| PR 质量评分 (0-100) | ✅ | ✅ |
| 语义级代码分析 | ❌ | ✅ |
| 幻觉 API 检测 | 基础 | 深度 |
| 项目约定学习 | ❌ | ✅ |
| 自动关闭 slop PR | ✅ | ✅ |

### 检查项目

- **🏷️ 标题** — Conventional Commit 格式、长度、屏蔽词
- **📝 描述** — 完整性检查、模板合规、AI 套话检测
- **📦 Commits** — 提交信息质量、作者匹配、无意义提交检测
- **🌿 分支** — 源/目标分支规则、命名规范
- **📁 文件** — 变更规模限制、敏感文件检测、过度注释检测
- **👤 贡献者** — 账号年龄、垃圾用户名检测、信任评分
- **🤖 AI Slop 信号** — Emoji 过载、幻觉 import、过度工程化

## 🚀 快速上手

### 方式一：仅规则模式（零成本、零配置）

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
      - uses: 1137043480/PRGuard@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### 方式二：规则 + AI 分析（使用你自己的 API Key）

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
      - uses: 1137043480/PRGuard@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: 'ai'
          ai-provider: 'openai'
          ai-api-key: ${{ secrets.OPENAI_API_KEY }}
          ai-model: 'gpt-4o-mini'
```

### 方式三：使用 Ollama（自托管、免费）

```yaml
      - uses: 1137043480/PRGuard@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: 'ai'
          ai-provider: 'ollama'
          ai-base-url: 'http://your-server:11434/v1'
          ai-model: 'llama3'
```

## ⚙️ 配置说明

### 评分阈值

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max-failures` | `4` | 触发动作前允许的最大检查失败数 |
| `min-quality-score` | `40` | 通过的最低分数 (0-100) |

### PR 标题

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `require-conventional-title` | `true` | 要求 Conventional Commit 风格标题 |
| `blocked-title-patterns` | `Update README.md,...` | 屏蔽的标题模式（正则） |

### PR 描述

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `require-description` | `true` | 要求填写 PR 描述 |
| `min-description-length` | `30` | 最短描述长度 |
| `max-description-length` | `5000` | 最长描述长度（超长=slop 信号）|
| `max-emoji-count` | `10` | 描述中最大 emoji 数量 |

### 提交检查

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `require-conventional-commits` | `false` | 要求 Conventional Commit 信息 |
| `require-commit-author-match` | `true` | 提交作者必须与 PR 作者一致 |

### 文件变更

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max-files-changed` | `50` | 最大变更文件数 |
| `max-additions` | `2000` | 最大新增行数 |
| `detect-excessive-comments` | `true` | 检测 AI 典型的过度注释 |
| `detect-hallucinated-imports` | `true` | 检测不存在的包 |

### 贡献者

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `min-account-age-days` | `7` | 最低账号年龄（天） |
| `detect-spam-usernames` | `true` | 检测随机/机器人用户名 |

### 动作

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `close-pr` | `false` | 自动关闭不合格 PR |
| `add-label` | `needs-review` | 不合格时添加的标签 |
| `comment-on-pr` | `true` | 发布评审评论 |

### 豁免规则

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `exempt-bots` | `true` | 豁免 bot 账号 |
| `exempt-draft-prs` | `true` | 豁免草稿 PR |
| `exempt-users` | `` | 豁免的用户名（逗号分隔）|
| `exempt-labels` | `` | 豁免的 PR 标签 |

> **注意：** Owner、Member、Collaborator **自动豁免**，无需额外配置。

## 📊 输出

| 输出 | 说明 |
|------|------|
| `quality-score` | 质量评分 (0-100) |
| `passed` | 是否通过 |
| `failures` | 失败检查数 |
| `report` | 完整 JSON 报告 |

## 🆚 与其他工具对比

| 功能 | PRGuard | anti-slop | PR-Agent | CodeRabbit |
|------|---------|-----------|----------|------------|
| 规则检查 | 30+ | 31 | ❌ | ❌ |
| AI 语义分析 | ✅ (BYOK) | ❌ | ✅ | ✅ |
| AI Slop 检测 | ✅ 深度 | ✅ 基础 | ❌ | ❌ |
| 质量评分 | ✅ 0-100 | ❌ | ❌ | ❌ |
| 自托管 AI (Ollama) | ✅ | ❌ | ❌ | ❌ |
| 零成本模式 | ✅ | ✅ | ❌ | ❌ |
| 协议 | MIT | MIT | Apache | 闭源 |

## 🤝 贡献

请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解贡献指南。

## 📄 许可证

MIT © [1137043480](https://github.com/1137043480)
