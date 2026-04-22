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

const sdk = mediause("mu-YOUR_API_KEY", {
  cli: {
    manifestUrl: "https://releases.mediause.dev/cli",
    autoInstall: true,
  },
});

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

## API Key 使用方式

支持 Tavily 风格初始化：

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

## 客户场景

- 用一套 SDK 统一管理多站点媒体运营自动化
- 构建结构化内容工作流（发布/抓取/审计）
- 集成站点级数据流程（电商与市场信息）
- 将 MediaUse 接入 AI Agent 系统并保持命令契约稳定

## 更多文档

- docs/CLI_COMMAND_TREE.md
- docs/ARCHITECTURE.md
- docs/SDK_TOOLKIT.md
- docs/ROADMAP.md
