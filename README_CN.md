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
| 40+ 项质量检查 | ✅ | ✅ |
| AI slop 模式检测 | ✅ | ✅ |
| PR 质量评分 (0-100) | ✅ | ✅ |
| **Import 验证（对照项目源码）** | ✅ | ✅ |
| **代码风格不一致检测** | ✅ | ✅ |
| **PR 历史 / 信誉分析** | ✅ | ✅ |
| **跨仓库垃圾 PR 检测** | ✅ | ✅ |
| **逐行 AI 代码审查** | ❌ | ✅ |
| **Import Graph 上下文注入** | ❌ | ✅ |
| 语义级代码分析 | ❌ | ✅ |
| 幻觉 API 检测 | 基础 | 深度 |
| 自动关闭 slop PR | ✅ | ✅ |

### 检查项目

- **🏷️ 标题** — Conventional Commit 格式、长度、屏蔽词
- **📝 描述** — 完整性检查、模板合规、AI 套话检测
- **📦 Commits** — 提交信息质量、作者匹配、无意义提交检测
- **🌿 分支** — 源/目标分支规则、命名规范
- **📁 文件** — 变更规模限制、敏感文件检测、过度注释检测
- **👤 贡献者** — 账号年龄、垃圾用户名检测、信任评分
- **🤖 AI Slop 信号** — Emoji 过载、幻觉 import、过度工程化

**V2 高级检测：**
- **📦 Import 验证** — 对照项目实际源码检查 import，而非猜测
- **🎨 代码风格** — 检测命名规范和缩进风格与项目的不一致
- **📜 PR 历史** — 分析作者的合并/拒绝率，标记屡次被拒的贡献者
- **🕸️ 跨仓库垃圾 PR** — 检测 24 小时内在 10+ 仓库提交 PR 的用户（机器人检测）

**V3 AI 代码审查**（需要 AI API key）：
- **📝 逐行代码审查** — AI 在代码的具体行上发布评论，像人类 reviewer 一样
- **🧠 Import Graph 上下文** — AI 读取项目关联文件（不只是 diff），可以发现重复逻辑、API 误用和风格不一致
- **⚡ 自动 Request Changes** — 发现严重问题时自动标记 PR 为"需要修改"

### 📸 输出示例

当 PRGuard 检测到低质量 PR 时，会发布详细的审查评论：

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

**逐行 AI 代码审查**（使用 `mode: 'ai'`）：

PRGuard 还会直接在代码行上发布评论 — 就像人类 reviewer 一样：

```
src/utils/auth-helper.ts line 8:
  🔴 严重: `useAuth()` 是 React Hook，不能在普通工具函数中调用，
  违反了 Hooks 使用规则。

src/utils/auth-helper.ts line 13:
  🟡 警告: `build_api_url` 与 `src/lib/apiClient.ts` 中的 `buildApiUrl`
  逻辑重复，且硬编码了 base URL。

src/utils/auth-helper.ts line 17:
  🔵 小建议: 函数命名 `fetch_user_data` 与项目的 camelCase TypeScript
  风格不一致。
```

> AI 通过 **Import Graph** 读取项目相关文件 — 它了解你的整个代码库，不只是 diff。

## 🚀 快速上手

### 第一步：创建 workflow 文件

在**你的**仓库中创建 `.github/workflows/pr-quality.yml` 文件：

```
你的项目/
├── src/
├── README.md
└── .github/
    └── workflows/
        └── pr-quality.yml   ← 创建这个文件
```

### 第二步：选择模式

#### 方式 A：仅规则模式（免费、零配置）

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
          # ↑ 由 GitHub 自动提供，你不需要创建
```

**搞定！** 之后每个 PR 都会自动进行质量检查，不需要 API key。

---

#### 方式 B：规则 + AI 代码审查（BYOK）

1. 进入你的仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. 添加你的 AI API key：
   - Name: `OPENAI_API_KEY` → Value: 你的 key（如 `sk-...`）
   - *（可选）* Name: `OPENAI_BASE_URL` → Value: 你的 API 地址

3. 更新 workflow：

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
          ai-base-url: ${{ secrets.OPENAI_BASE_URL }}  # 可选
          ai-model: 'gpt-5'
```

> 🔒 **你的 API key 是安全的。** 它存储在 GitHub Secrets 中 — 不会暴露在代码、日志或 PRGuard 中。

### 第三步：完成！

下次有人发起 PR 时，PRGuard 会在 30 秒内自动运行。

---

### 支持的 AI 提供商

任何支持 OpenAI `/v1/chat/completions` 接口的提供商都可以用。只需设置 `ai-provider: 'openai'` 并将 `ai-base-url` 指向你的接口：

| 提供商 | `ai-base-url` | 推荐模型 | 备注 |
|--------|---------------|----------|------|
| **OpenAI** | *（默认，不需要设置）* | `gpt-5` | 代码审查效果最好，也可用 `codex-mini-latest` |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` | 对应 DeepSeek-V3.2，性价比极高 |
| **Groq** | `https://api.groq.com/openai/v1` | `meta-llama/llama-4-scout-17b-16e-instruct` | 超快推理速度 |
| **Together AI** | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | 速度与质量平衡 |
| **Mistral** | `https://api.mistral.ai/v1` | `mistral-large-latest` | 始终指向最新版本 |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `anthropic/claude-sonnet-4-20250514` | 一个 API 访问所有模型 |
| **NewAPI / One API** | `https://your-server.com/v1` | 任意模型 | 自托管 API 网关 |
| **Ollama（自托管）** | `http://your-server:11434/v1` | `llama3.3` | 免费、完全私有，数据不出服务器 |

如需使用 **Anthropic Claude**（原生 API，非 OpenAI 兼容）：
```yaml
          ai-provider: 'anthropic'
          ai-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          ai-model: 'claude-sonnet-4-20250514'
```

## ⚙️ 配置说明（可选）

以下所有设置都是**可选的** — PRGuard 开箱即用，默认值已经很合理。只有想自定义行为时才需要修改。

> 💡 以下参数控制**规则模式**的行为（所有模式通用）。AI 模式的参数（`mode`、`ai-provider`、`ai-api-key` 等）已在上方「快速上手」中说明。

```yaml
- uses: 1137043480/PRGuard@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    max-failures: 6         # ← 可选：覆盖下面的任何默认值
    min-quality-score: 60
```

### 评分阈值

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max-failures` | `4` | 允许多少项检查失败后才标记 PR。想宽松一些就调大 |
| `min-quality-score` | `40` | PR 必须达到的最低分数 (0-100)。想要更严格就调高（如 `70`）|

### PR 标题

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `require-conventional-title` | `true` | 要求标题格式如 `feat: ...`、`fix: ...`、`docs: ...`。如果项目不用 conventional commit 可以设为 `false` |
| `blocked-title-patterns` | `Update README.md,...` | 自动生成的标题会被标记，如 GitHub 默认的 "Update README.md" |

### PR 描述

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `require-description` | `true` | 要求 PR 正文不能为空。小型项目可以设为 `false` |
| `min-description-length` | `30` | PR 正文的最少字符数。描述太短通常意味着低质量 PR |
| `max-description-length` | `5000` | 标记过长的描述 — AI 生成的 slop 常见特征 |
| `max-emoji-count` | `10` | 标记 emoji 过多的描述 — 另一个 AI slop 信号 |

### 提交检查

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `require-conventional-commits` | `false` | 要求每条 commit 消息遵循 `type: message` 格式。默认关闭因为很多项目不强制要求 |
| `require-commit-author-match` | `true` | commit 作者邮箱必须与 PR 作者一致。可以发现复制/偷来的提交 |

### 文件变更

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max-files-changed` | `50` | 标记修改文件过多的 PR。大规模 PR 通常是 AI 生成的批量修改 |
| `max-additions` | `2000` | 标记新增行数过多的 PR。大量代码 dump 是 slop 信号 |
| `detect-excessive-comments` | `true` | 检测 AI 风格的注释，如在 `let x = 0` 上写 `// 初始化变量` |
| `detect-hallucinated-imports` | `true` | 检查导入的包是否真实存在。AI 经常编造不存在的包名 |

### 贡献者

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `min-account-age-days` | `7` | 标记创建不到 7 天的账号。新账号通常是垃圾机器人 |
| `detect-spam-usernames` | `true` | 标记看起来随机的用户名，如 `xjk283hd` — 机器人账号的典型特征 |

### 动作 — PR 不合格时 PRGuard 做什么

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `close-pr` | `false` | 自动关闭不合格 PR。**谨慎使用** — 只在收到大量垃圾 PR 时启用 |
| `add-label` | `needs-review` | 为不合格 PR 添加标签，方便在 GitHub 中过滤 |
| `comment-on-pr` | `true` | 发布详细的审查评论（含评分和问题）。设为 `false` 则静默运行 |

### 豁免规则 — 谁可以跳过 PRGuard 检查

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `exempt-bots` | `true` | 跳过 Dependabot、Renovate 等已知机器人 |
| `exempt-draft-prs` | `true` | 跳过草稿 PR（还在开发中）|
| `exempt-users` | `` | 跳过特定用户，如 `user1,user2`（逗号分隔）|
| `exempt-labels` | `` | 跳过带有特定标签的 PR，如 `skip-review,trusted` |

> **注意：** 仓库的 Owner、Member、Collaborator **自动豁免**，无需额外配置。

## 📊 输出

| 输出 | 说明 |
|------|------|
| `quality-score` | 质量评分 (0-100) |
| `passed` | 是否通过 |
| `failures` | 失败检查数 |
| `report` | 完整 JSON 报告 |

此外，PRGuard 还会发布：
- **📋 总结评论** — 质量评分、规则违规、AI 分析（每个 PR 都有）
- **📝 逐行审查评论** — 在具体代码行上给出反馈（仅 AI 模式）
- **🏷️ 标签** — 为不合格 PR 添加可配置标签
- **🔄 Request Changes** — 发现严重问题时自动标记 PR 为"需要修改"（仅 AI 模式）

## 🆚 与其他工具对比

| 功能 | PRGuard | anti-slop | PR-Agent | CodeRabbit |
|------|---------|-----------|----------|------------|
| 规则检查 | 40+ | 31 | ❌ | ❌ |
| 逐行 AI 审查 | ✅ (BYOK) | ❌ | ✅ | ✅ |
| Import Graph 上下文 | ✅ | ❌ | ❌ | ✅ |
| AI Slop 检测 | ✅ 深度 | ✅ 基础 | ❌ | ❌ |
| Import 验证 | ✅ 6 种语言 | ❌ | ❌ | ❌ |
| 质量评分 | ✅ 0-100 | ❌ | ❌ | ❌ |
| 自托管 AI (Ollama) | ✅ | ❌ | ❌ | ❌ |
| 零成本模式 | ✅ | ✅ | ❌ | ❌ |
| 协议 | MIT | MIT | Apache | 闭源 |

## 🤝 贡献

请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解贡献指南。

## 📄 许可证

MIT © [1137043480](https://github.com/1137043480)
