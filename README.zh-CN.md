# MediaUse Core

语言: [English](README.md) | [中文](README.zh-CN.md)

MediaUse 是一个面向 Web 媒体运营的 AI 基础设施项目。
官网: https://mediause.dev/

本仓库发布 TypeScript SDK 包 @mediause/core。

## MediaUse 是什么

MediaUse 将网站操作标准化为 CLI + SDK 模型，可供开发者、AI Agent 和自动化系统使用。

与仅面向社交媒体的工具不同，MediaUse 面向更广泛的 Web 媒体场景，包括：

- 社交平台（例如：Twitter）
- 内容与发布类网站
- 电商数据工作流
- 股票与市场信息工作流

这些能力通过 site plugin 提供。

## 为什么选择 MediaUse

- 原生 Rust CLI，不是 Node.js 包装层，毫秒级启动
- 可与任意 AI Agent 配合使用（Cursor、Claude Code、Codex、Continue、Windsurf 等）
- 基于 CDP 驱动 Chrome/Chromium，不依赖 Playwright 或 Puppeteer
- 支持 OAuth、Webhook、Bridge 模式与自动化模式
- 内置会话管理、认证密钥库与状态持久化
- 支持原生 Web APIs

## MediaUse CLI 与 SDK

MediaUse CLI 是规范执行层。
本仓库中的 SDK 在该执行层之上提供开发者友好的 API。

在实际使用中：

- CLI 定义命令契约与运行时行为
- SDK 提供编排与集成体验
- SDK 负责本地 CLI 二进制的就绪与版本对齐

## 面向客户的核心价值

- 一套 SDK 接口覆盖多类网站域
- 通过 site plugin 扩展能力，而不是一次性接入
- 内置本地 CLI 引导与版本管理
- 通过结构化命令流与 Agent 框架兼容

## 安装

```bash
npm install @mediause/core
```

如果你是直接在源码仓库中工作：

```bash
npm install
```

## 快速开始

```ts
import { mediause } from "@mediause/core";

const sdk = mediause("mu-YOUR_API_KEY");

await sdk.auth.login("weibo");
await sdk.use.account("weibo:main");

await sdk.site("weibo").post.feed({
  title: "Hello from MediaUse",
  content: "Simple SDK flow",
  media: ["./cover.jpg"],
});
```

## 简化 SDK API

SDK 推荐使用直观的根级链式调用：

```ts
import { mediause } from "@mediause/core";

const sdk = mediause("mu-YOUR_API_KEY");

await sdk.auth.list();
await sdk.auth.login("weibo");

await sdk.site("weibo").post.feed({
  title: "Title",
  content: "Body",
  media: ["./a.jpg", "./b.jpg"],
  draft: true,
});
```

所有 CLI-facing 操作都可以通过链式 API 调用：

```ts
await sdk.auth.list();
await sdk.auth.login("weibo");

await sdk.registry.list({ json: true });
await sdk.registry.add("weibo", { json: true });

await sdk.use.account("weibo:main", {
  policy: "balanced",
  idleTimeoutSeconds: 120,
  json: true,
});

await sdk.manage.context.open(true);
await sdk.manage.key.get();
await sdk.manage.key.set("mu-NEW_KEY");
await sdk.manage.task({ id: "task-id", json: true });
await sdk.task.status("task-id");
await sdk.trace.last();

await sdk.help.root(true);
await sdk.version.get(true);
await sdk.close.run(true);
```

动态站点命令支持：

- `sdk.site("<site>").<capability>.<action>(input, payload?)`
- `sdk.site().<capability>.<action>(input, payload?)`（active context）
- `sdk.flow("<site>", "<account>").<capability>.<action>(input, payload?)`（flow 简写）

`input` 支持对象、字符串数组或基础类型。
对象会按确定性规则转换为 CLI 参数：

- camelCase 转 kebab-case flag
- 数组值转换为重复 flag
- `true` 转换为仅 flag 开关
- `false`、`null`、`undefined` 会被忽略

## Flow 约束（对齐 Skill）

对于小红书等场景，推荐顺序是：

1. discover 站点命令
2. use account 绑定账号上下文
3. auth health 检查
4. 执行动态能力

你可以使用内置 flow 强制这个顺序：

```ts
const flow = sdk.flow("xiaohongshu", "main");

await flow.discover();
await flow.useAccount({ policy: "balanced" });
await flow.authHealth();

await flow.search.hot();
await flow.post.feed({
  title: "今日推荐",
  text: "草稿内容",
  media: ["c:/tmp/a.png"],
});

await sdk.trace.last();
```

一键准备方式：

```ts
const flow = sdk.flow("xiaohongshu", "main");
await flow.ready({ useAccount: { policy: "balanced" } });
await flow.post.feed({ title: "hello", text: "world" });
```

## API Key 使用方式

支持初始化时传入：

```ts
import { mediause } from "@mediause/core";

const sdk = mediause("mu-YOUR_API_KEY", {
  cli: {
    manifestUrl: "https://releases.mediause.dev/cli",
  },
});
```

也支持兼容字段输入：

```ts
const sdk = mediause(undefined, {
  api_key: "mu-YOUR_API_KEY",
  cli: { manifestUrl: "https://releases.mediause.dev/cli" },
});
```

运行时密钥操作：

```ts
await sdk.setApiKey("mu-NEW_KEY");
const currentKey = await sdk.getApiKey();
```

## 高级 CLI 控制

如果你需要更底层的命令控制，仍可直接使用 Executor：

```ts
const cli = await sdk.createCliExecutor();

await cli.sitesList();
await cli.executeCore(["auth", "list"]);
await cli.executeSite({
  mode: "active-context",
  capability: "content",
  action: "publish",
  args: ["--text", "Hello from MediaUse"],
});
```

## CLI 二进制引导

SDK 同时支持安装阶段与运行阶段的 MediaUse CLI 二进制引导。

行为概要：

1. 检测操作系统与架构
2. 解析目标 CLI 版本（固定版本或 latest）
3. 若有可用本地版本则复用
4. 必要时下载并校验 checksum
5. 若无兼容产物则快速失败

常用环境变量：

- MEDIAUSE_SKIP_POSTINSTALL=1
- MEDIAUSE_CLI_VERSION=3.2.1
- MEDIAUSE_CLI_MANIFEST_URL=https://releases.mediause.dev/cli
- MEDIAUSE_CLI_LATEST_VERSION_URL=...
- MEDIAUSE_CLI_CACHE_DIR=...
- MEDIAUSE_CLI_BINARY_NAME=mediause
- MEDIAUSE_CLI_POSTINSTALL_STRICT=0

## 命令模型

MediaUse 使用 Core + Sites 命令模型：

- Core 命令: sites, auth, use, manage, trace, task, rpc, help/version/close
- Site 动态命令: 由 site plugin manifest 暴露 capability/action

动态调用形式：

- mediause <site> <capability> <action> [args]
- mediause <capability> <action> [args]
- mediause.<capability>.<action> [args]
- mediause.<site>.<capability>.<action> [args]

Core 命令补充：

- 支持 `auth login <platform[/entry]>`，用于同站点多登录体系（例如：`mediause auth login xiaohongshu/creator`）。
- `manage context --open` 用于打开/聚焦当前 context webview；`manage context --close` 会关闭当前 webview session。

## 客户场景

- 用一套 SDK 统一管理多站点媒体运营自动化
- 构建结构化内容工作流（发布/抓取/审计）
- 集成站点级数据流程（电商与市场信息）
- 将 MediaUse 接入 AI Agent 系统并保持命令契约稳定

## 更多文档

- docs/CLI_COMMAND_TREE.md
- docs/ARCHITECTURE.md
- docs/SDK_USAGE_GUIDE.md
- docs/SDK_USAGE_GUIDE.zh-CN.md
- docs/SDK_TOOLKIT.md
- docs/ROADMAP.md
