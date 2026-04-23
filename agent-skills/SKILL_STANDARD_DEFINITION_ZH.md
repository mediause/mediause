# MediaUse Skill 标准化定义规范（可复用模板）

本文档定义一个可复用的 Skill 标准结构，目标是：

- 让 Agent 更容易理解并稳定调用 MediaUse CLI。
- 统一不同网站 Skill 的安装、鉴权、执行、约束与输出格式。
- 基于同一模板快速生成各站点 Skill（如 weibo、xiaohongshu、zhihu）。

适用架构：core cmd + site dynamic cmd。

## 1. 安装与下载（Installation）

### 1.1 二进制安装

当前仅支持 Windows，暂不支持 macOS 和 Linux。

使用官方 Windows 安装脚本：

- https://release.mediause.dev/install.ps1

```powershell
powershell -C "iwr https://release.mediause.dev/install.ps1 -UseBasicParsing | iex"
```

### 1.2 Skill 安装目录建议

建议每个站点 Skill 独立目录：

- .mediause/skills/<site>/SKILL.md
- .mediause/skills/<site>/examples/
- .mediause/skills/<site>/schema/

说明：

- 一个 Skill 对应一个主站点。
- 通用流程（auth/use/trace/task）保持一致。

## 2. Key 获取与配置（Auth / Key）

### 2.1 API Key 获取

如果流程依赖云侧能力或网关鉴权，要求用户先获取 API Key。

当前标准获取流程：

1. 访问 https://mediause.dev/
2. 完成账号登录
3. 进入 Project 页面
4. 在 Project 下创建或复制 API Key

Skill 中应明确：

- Key 来源地址
- Key 生效范围（本机 / 会话 / 环境变量）
- Key 失效或缺失时的标准报错提示

### 2.2 本地配置方式

```powershell
# 方式 A：环境变量
$env:MEDIAUSE_API_KEY = "<your_key>"

# 方式 B：CLI 持久化（推荐）
mediause manage key <your_key> --json
```

### 2.3 鉴权验证

```powershell
mediause auth list --json
mediause auth health --json
```

执行约束：

- `auth health` 仅在 `use account` 成功后可用，用于查询当前绑定上下文的登录/授权状态。
- `use account` 的参数格式为 `<platform:account_id>`，其中 `account_id` 可通过 `mediause auth list --json` 获取。
- 若尚未完成 `use account`，不得调用 `auth health`，应先执行 `mediause use account <site>:<account_id> --json`。
- 若 `auth health` 结果显示未登录或授权失效，必须执行 `mediause auth login <site> --json`，然后重新 `use account` 并再次 `auth health`。

## 3. 命令介绍与标准调用流程（Core + Dynamic）

## 3.1 Core 通用指令（所有 Skill 必须支持）

每个 Skill 文档都必须至少覆盖以下 core 指令：

- mediause sites list
- mediause sites add <site>
- mediause auth login <platform>
- mediause use account <platform:account_id> [--policy]
- mediause auth health
- mediause trace last
- mediause task status --task-id <id>
- mediause task trace --task-id <id>
- mediause manage context --show|--close|--clear
- mediause --version 或 mediause -v

可选模式：

- mediause use account <site>:guest（仅部分网站支持）

## 3.2 每次任务都应执行的标准流程

强前置条件：

- 只有在 `mediause use account <platform:account_id>` 成功执行后，才可以继续执行读取（get/search/user...）与发布（post/reply/engage...）操作。
- 若未完成 `use account`，Skill 必须中止业务命令并返回引导信息。
- 支持 guest 的网站可使用 `mediause use account <site>:guest` 进入访客模式；该模式只允许读取操作，不允许发布/互动写操作。

建议固化为 5 步：

1. 发现与检查：sites list / sites add / site help
2. 绑定上下文：use account（必须成功）
3. 状态检查：auth health（未登录则 auth login，再次 use account + auth health）
4. 执行动作：site dynamic command
5. 回溯验证：trace/task

访客模式分支：

- 若目标网站支持 guest，可在第 2 步使用 `mediause use account <site>:guest --json`。
- 无需第 3 步进行状态检查
- guest 模式下仅执行 read/fetch 类动作。
- 当执行 post/reply/engage 等写动作时，Skill 必须直接拦截并提示切换到已登录账号。

示例：

```powershell
mediause sites list --json
mediause sites add weibo --json
mediause weibo -h
mediause weibo post -h
mediause use account weibo:main --policy balanced --json
mediause auth health --json
mediause auth login weibo --json
mediause use account weibo:main --policy balanced --json
mediause auth health --json
mediause weibo search hot --json
mediause trace last --json

# guest 模式（仅当站点支持）
mediause use account weibo:guest --json
mediause weibo search hot --json
```

## 3.3 Dynamic 命令说明（站点能力）

站点动作来自：

- crates/platforms/src/<site>/commands.json

以 weibo 为例，能力域包括：

- post
- get
- user
- reply
- search
- engage

Skill 应只声明 manifest 已存在的能力，不要虚构命令。

参数发现规范：

- 通过 `mediause <site> -h` 查看站点 capability 总览。
- 通过 `mediause <site> <capability> -h` 查看 capability 下各 action 与参数。
- 例如：`mediause weibo post -h`。
- 单站点 Skill 必须提供完整 site cmd map（capability/action/args/示例），并与 help 输出保持一致。

站点插件获取规范：

- 通过 `mediause sites list` 获取当前支持网站。
- 通过 `mediause sites add <site>` 获取并安装对应网站 plugin。

guest 支持规范：

- guest 不是全站点通用能力，只在部分网站可用。
- 单站点 Skill 必须显式声明该站点是否支持 guest。
- 若不支持 guest，Skill 必须提示使用 `auth login <site>` + `use account <site>:<account>` 标准登录流程。

## 4. 命令组合实例与 Workflow 设计

本节定义 Agent 可直接执行的组合模式。

### 4.1 Workflow A：热点发现到草稿发布

```powershell
# A1. 登录与上下文
mediause auth login weibo --json
mediause use account weibo:main --json

# A2. 获取热点
mediause weibo search hot --json

# A3. 生成草稿（外部 LLM 处理）后发布
mediause weibo post feed --text "<draft_text>" --media c:/tmp/a.png --json

# A4. 验证
mediause trace last --json
```

### 4.2 Workflow B：监控 + 互动闭环

```powershell
mediause use account weibo:main --json
mediause weibo get notif --type mention --json
mediause weibo reply comment --post-id <id> --text "收到，感谢" --json
mediause trace last --json
```

### 4.3 Workflow C：用户运营

```powershell
mediause use account weibo:main --json
mediause weibo user followers --user-id <uid> --limit 20 --json
mediause weibo engage follow --user-id <uid> --json
mediause trace last --json
```

## 5. 使用约束与合规策略（Guardrails）

每个 Skill 必须包含并默认启用以下策略。

### 5.1 反垃圾与反滥用

- 不批量生成重复文案。
- 不对同一对象进行高频重复互动（like/follow/comment/message）。
- 不绕过平台风控、验证码或封禁策略。

### 5.2 频率控制建议

建议 Skill 显式给出节流窗口（可按站点覆盖）：

- 发布类：每账号每小时 <= 3 次
- 评论/私信类：每账号每小时 <= 20 次
- 关注/点赞类：每账号每小时 <= 30 次
- 搜索/读取类：每分钟 <= 60 次

操作间隔（最小冷却时间，默认值）：

- 发布类（post）：两次发布间隔 >= 20 分钟
- 评论/私信类（reply/message）：同账号连续操作间隔 >= 30 秒
- 关注/点赞类（engage）：同账号连续操作间隔 >= 10 秒
- 搜索/读取类（get/search/user）：同账号连续操作间隔 >= 1 秒

同目标额外限制：

- 同一目标对象（同 post_id/user_id）重复互动间隔 >= 60 秒
- 相同文案重复发布间隔 >= 24 小时（默认禁止直接重复）

超过阈值时，Skill 应返回明确拒绝并提示等待。

### 5.3 内容安全与业务约束

- 不生成 spam、诈骗、诱导互动内容。
- 不生成违法、侵权、仇恨、骚扰内容。
- 对医疗、金融、招聘等高风险内容增加人工确认步骤。

### 5.4 失败处理

- 必须返回结构化错误（error_code / message / suggestion）。
- 优先使用 --json 调用，便于 Agent 重试与分支决策。

## 6. 标准化 Skill 文档结构（强约束）

建议每个站点 Skill 都按以下固定章节输出：

1. Skill 元信息
2. 安装
3. Key 配置
4. Core 指令
5. Site 指令（来自 commands.json）
6. 标准 Workflow
7. 约束与频控
8. 错误码与恢复
9. 最小验证清单

## 7. Skill 模板（可直接复制）

```markdown
---
name: mediause-<site>
description: Standardized MediaUse skill for <site> automation.
allowed-tools: Bash(MediaUse:*)
---

# 1. Install
- binary source:
- local path:

# 2. Key Setup
- MEDIAUSE_API_KEY:
- mediause manage key:

# 3. Core Commands
- sites list
- auth login
- use account
- auth health
- trace/task

# 4. Site Commands
- source manifest: crates/platforms/src/<site>/commands.json
- supported capabilities:

# 5. Workflows
- workflow-a:
- workflow-b:

# 6. Guardrails
- anti-spam
- rate-limit
- policy constraints

# 7. Recovery
- common errors
- retry strategy
```

## 8. 如何基于该规范批量生成各网站 Skill

生成流程建议：

1. 读取目标站点 commands.json。
2. 抽取 capability/action/args 与 risk_level。
3. 自动填充 Skill 模板的 Site Commands 与 Workflow 示例。
4. 注入统一 Guardrails（反垃圾 + 频控 + 合规）。
5. 输出后做一次可执行性校验（至少 1 条 read + 1 条 write + trace）。

这样可以保证：

- 不同站点 Skill 的结构一致。
- Agent 更容易形成稳定调用策略。
- 新站点接入成本降低，文档质量可控。

## 9. 最小验收清单（Definition of Done）

- 包含安装、key、core 流程、workflow、约束 5 大部分。
- 所有站点动作均来自对应 commands.json。
- 至少提供 2 个端到端 workflow。
- 明确频率限制与反 spam 规则。
- 示例命令可直接运行（建议均提供 --json）。
