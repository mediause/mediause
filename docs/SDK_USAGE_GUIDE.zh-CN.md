# MediaUse SDK 使用指南

本文档是 `@mediause/core` 的中文实战手册，帮助开发者快速接入并稳定运行。

推荐调用风格：

- 根级链式命令：`sdk.auth.list()`、`sdk.use.account(...)`、`sdk.manage.context.open()`
- 动态站点链式命令：`sdk.site("weibo").post.feed(...)`
- flow 约束简写：`sdk.flow("xiaohongshu", "main").search.hot()`

## 1. 安装与初始化

安装：

```bash
npm install @mediause/core
```

初始化 SDK：

```ts
import { mediause } from "@mediause/core";

const sdk = mediause("mu-YOUR_API_KEY", {
  cli: {
    manifestUrl: "https://releases.mediause.dev/cli",
    autoInstall: true,
  },
});
```

说明：

- 推荐使用 `mediause("mu-...")` 作为初始化方式。
- 兼容输入字段 `api_key` 仍可使用。
- CLI 引导为懒加载，在首次命令执行前自动完成。

## 2. API 总览

SDK 推荐三种调用方式：

1. 根级链式调用（适合所有 CLI Core 命令）
2. 动态站点调用（`sdk.site(...)`）
3. Flow 约束调用（`sdk.flow(...)`，带顺序约束与简写）

### 2.1 根级链式调用

```ts
await sdk.auth.list();
await sdk.auth.login("weibo");
await sdk.auth.login("xiaohongshu/creator");

await sdk.registry.list({ json: true });
await sdk.registry.add("xiaohongshu", { json: true });

await sdk.use.account("xiaohongshu:main", {
  policy: "balanced",
  idleTimeoutSeconds: 120,
  json: true,
});

await sdk.manage.context.show(true);
await sdk.manage.context.open(true);
await sdk.manage.context.close(true);
await sdk.manage.context.clear(true);

await sdk.manage.key.get();
await sdk.manage.key.set("mu-NEW_KEY");

await sdk.manage.task({ id: "task-id", json: true });
await sdk.task.status("task-id");
await sdk.task.trace("task-id");

await sdk.trace.last();
await sdk.rpc.serve({ protocol: "jsonrpc-stdio" });

await sdk.help.root(true);
await sdk.version.get(true);
await sdk.close.run(true);
```

### 2.2 动态站点调用

显式站点：

```ts
await sdk.site("weibo").post.feed({
  title: "标题",
  text: "正文",
  media: ["./a.jpg", "./b.jpg"],
  draft: true,
});
```

活动上下文：

```ts
await sdk.site().search.hot();
```

### 2.3 Flow 约束调用（推荐用于账号敏感流程）

Flow 会约束顺序，并支持 `flow.search.hot()` 这种同上下文简写。

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

一键准备：

```ts
const flow = sdk.flow("xiaohongshu", "main");
await flow.ready({ useAccount: { policy: "balanced" } });
await flow.post.feed({ title: "hello", text: "world" });
```

## 3. 与 CLI 的命令映射

SDK 是 CLI 契约的封装层，不会扩展新的后端协议。

示例：

- `sdk.auth.login("weibo")` -> `mediause auth login weibo`
- `sdk.auth.login("xiaohongshu/creator")` -> `mediause auth login xiaohongshu/creator`
- `sdk.use.account("xiaohongshu:main")` -> `mediause use account xiaohongshu:main`
- `sdk.site("xiaohongshu").search.hot()` -> `mediause xiaohongshu search hot`
- `sdk.site().post.feed(...)` -> `mediause post feed ...`（活动上下文）

`auth login` 支持两种形态：

1. `platform`（例如 `weibo`）
2. `platform/entry`（例如 `xiaohongshu/creator`）

当同一平台存在多个登录入口体系时，使用 `platform/entry`。

## 4. 动态参数序列化规则

动态 action 支持三类输入：

- 对象
- argv 数组
- 基础类型（`string | number | boolean`）

对象转 argv 规则：

1. key 按字典序排序
2. camelCase 转 kebab-case flag
3. 数组转重复 flag
4. `true` 转无值 flag
5. `false`、`null`、`undefined` 忽略
6. 对象值默认 JSON 字符串化

输入：

```ts
{
  title: "A",
  text: "B",
  media: ["a.jpg", "b.jpg"],
  dryRun: false,
  draft: true,
  meta: { source: "guide" },
}
```

生成：

```text
--draft --media a.jpg --media b.jpg --meta {"source":"guide"} --text B --title A
```

## 5. Flow 约束与安全顺序

Flow 对齐运营 skill 的调用顺序：

1. discover 站点命令
2. use account 绑定账号上下文
3. auth health 检查登录健康
4. 执行动态 action

若在 `useAccount()` / `authHealth()` 之前执行动态能力，flow 会抛出明确错误。

## 6. API Key 管理

运行时设置 key：

```ts
await sdk.setApiKey("mu-NEW_KEY");
```

读取当前 key：

```ts
const key = await sdk.getApiKey();
```

兼容写法：

```ts
const sdk = mediause(undefined, {
  api_key: "mu-YOUR_API_KEY",
  cli: { manifestUrl: "https://releases.mediause.dev/cli" },
});
```

## 7. 错误处理建议

推荐结构：

```ts
try {
  await sdk.use.account("xiaohongshu:main", { json: true });
  await sdk.auth.health({ json: true });
  await sdk.site("xiaohongshu").post.feed({ title: "hello", text: "world" });
} catch (error) {
  console.error("MediaUse SDK 执行失败", error);
  await sdk.trace.last().catch(() => undefined);
}
```

说明：

- flow 顺序违规通常是同步抛错（能力访问阶段）
- CLI 执行失败通常是异步 reject（命令执行阶段）

## 8. 小红书完整示例

```ts
const flow = sdk.flow("xiaohongshu", "main");

await flow.ready({
  useAccount: {
    policy: "balanced",
    json: true,
  },
  authHealth: { json: true },
});

await flow.search.hot();

await flow.post.feed({
  title: "2026穿搭",
  text: "今日分享",
  media: ["c:/tmp/a.mp4"],
  cover: "c:/tmp/cover.png",
});

await sdk.trace.last();
```

## 9. 高级模式（直接使用 Executor）

若需要底层控制，可直接使用 `createCliExecutor()`：

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

建议仅在根级链式 / flow 链式无法满足时使用。

## 10. 迁移速查

旧写法：

```ts
const cli = await sdk.createCliExecutor();
await cli.executeCore(["auth", "list"]);
await cli.executeSite({
  mode: "explicit-site",
  site: "weibo",
  capability: "post",
  action: "feed",
  args: ["--text", "hello"],
});
```

推荐写法：

```ts
await sdk.auth.list();
await sdk.site("weibo").post.feed({ text: "hello" });
```

flow 约束写法：

```ts
const flow = sdk.flow("weibo", "main");
await flow.ready();
await flow.post.feed({ text: "hello" });
```

## 11. 最佳实践

1. Core 命令优先使用根级链式（`sdk.xxx`）。
2. 发布/互动等账号敏感流程优先使用 `sdk.flow(...)`。
3. 机器处理流程建议显式 `json: true`。
4. 失败后先查 `sdk.trace.last()`。
5. 仅在必要时使用 `createCliExecutor()` 低层模式。

## 12. 快速参考

- 登录：`sdk.auth.login("xiaohongshu")`
- 绑定上下文：`sdk.use.account("xiaohongshu:main", { json: true })`
- 健康检查：`sdk.auth.health({ json: true })`
- 站点发现：`sdk.registry.list({ json: true })`
- 动态读取：`sdk.site("xiaohongshu").search.hot()`
- flow 简写：`sdk.flow("xiaohongshu", "main").search.hot()`
- 发布：`sdk.site("xiaohongshu").post.feed({ title, text, media })`
- 最近 trace：`sdk.trace.last()`
