# Codex 对话

在 Lumi 中直接与 Codex 对话并完成任务的**显示层**：经主程序的受限桥接，把本机 `codex app-server` 的 JSON-RPC 会话透传到本插件，由插件渲染对话、工具调用、文件改动、计划与审批。

- 插件 ID：`extension.lumi.codex`
- 版本：2.0.1（原“Codex 接入/订阅用量”已移除，订阅用量请用主程序内置的 `provider.codex`）
- 类型：功能插件（`kind: feature`）
- 权限：`codex.bridge`

## 定位

Lumi **只作显示桥接**：主程序不解释 Codex 协议、不覆盖沙箱与审批设置，只提供一条受白名单约束的 JSON-RPC 隧道与推流。登录、模型、沙箱、审批策略全部由 Codex 自身配置决定，插件不自动审批、不读取或保存凭据。

## 显示位置

| 位置 | 内容 |
| --- | --- |
| 侧栏 → 工具 → Codex | 完整对话界面：会话列表、消息流、命令输出、diff、计划、审批、模型/强度与工作目录 |
| 常规设置 → 连接 | Codex CLI 检测与登录指引 |
| 设置 → Codex 对话 | 权限、数据流与白名单说明 |

## 依赖与安装

最低宿主版本：**Lumi 0.5.17**，宿主 API v1。

1. 安装 Codex CLI，并在终端运行 `codex login` 完成登录。
2. 在 常规设置 → 插件 中启用**内置**“Codex 桥接”（`provider.codex-bridge`，默认关闭）。
3. 复制本目录到 Lumi 的额外插件目录，重新扫描并启用本插件。
4. 打开侧栏“Codex”，选择工作目录与模型后即可对话。

缺少桥接能力（旧版 Lumi）时会提示“需要更新 Lumi”。插件仅在 `hostApiVersion: 1` 下使用新增的 `codex.bridge` 权限；旧宿主会因未知权限将本包判为无效。

## 桥接接口（主程序提供）

- `sdk.codex.bridge.status()` → `{installed, state, detail?}`
- `sdk.codex.bridge.send({method, params, notify?})` → `{result?|error?}`（方法白名单）
- `sdk.codex.bridge.respond({id, result?|error?})` → 回写服务端请求（审批）
- `sdk.codex.bridge.chooseDirectory()` → `{path}|null`（用户磁盘选择）
- `sdk.codex.bridge.subscribe(listener)` / `sdk.onEvent('codex.bridge', listener)` → 原样接收所有入站消息

允许的方法：`initialize`、`initialized`、`thread/*`（start/resume/read/list/fork/name/archive/unarchive/delete/loaded/turns/items）、`turn/*`（start/steer/interrupt）、`model/list`、`skills/list`、`account/read`、`account/rateLimits/read`。

拒绝：`process/*`、`command/exec*`、`thread/shellCommand`、`fs/*`、`account` 写入、`config` 写入、`marketplace/*`、`plugin/*`、`windowsSandbox/*` 等。

## 交互

- 会话：新建、搜索、重命名、归档、删除；打开旧会话先 `thread/read` 渲染历史再 `thread/resume` 订阅。
- 对话：`turn/start` 发送；`turn/steer` 追加指示；`turn/interrupt` 中断；模型与推理强度来自 `model/list`。
- 审批：收到命令执行 / 文件改动 / 权限 / MCP 等审批请求时弹窗，用户选择后经 `respond` 原样回写；超时由主程序回写错误，避免挂起。
- 支持补充问题的文本或选项答案；不支持的请求只提供拒绝，审批失败时保留操作卡片，不自动放行。
- 重命名与删除在页面内确认，兼容沙箱 iframe；连接中断可点击“重连”，模型默认值与强度保持由 Codex 自身决定。
- 运行任务时锁定会话切换；离开对话页、停用插件或重新扫描会关闭所属连接并终止在途任务。历史会话仍由 Codex 保存，重新打开后可恢复。
- 事件：`item/agentMessage/delta`、`item/reasoning/*`、`item/commandExecution/outputDelta`、`turn/plan/updated`、`turn/diff/updated`、`item/completed`、`turn/completed`、`error`/`warning`。

## 安全边界

- 不自动审批；不解释协议内容；不落地会话正文。
- 工作目录只来自用户磁盘选择；不枚举任意路径。
- 停用插件或退出应用时，主程序终止 app-server 子进程并撤销订阅。

## 验证

在已安装的 Lumi 中：启用内置桥接并 `codex login` 后，新建会话，发送一个需要执行命令的任务。应看到文本流式输出、命令卡片与输出、按 Codex 自身策略出现的审批弹窗、文件 diff 与计划；中断可停止；会话列表出现该会话且可重开继续。停用插件后子进程应被终止。

包结构校验（需主程序改动发布后更新 `host.json` 固定宿主）：

```sh
npm run check -- plugins/extension.lumi.codex
```

## 2.0.1 验证记录

2026-10-06，Windows x64，匹配宿主 Lumi 0.5.17（`a3212067edecd15cfe5d312d99c741ea109f9441`）。`npm run check` 全部目录包通过；`node scripts/check-codex-ui.mjs <宿主checkout>` 的真实 Electron 沙箱回归通过，覆盖流式消息、跨线程事件撤回、不自动审批、审批失败重试、补充问题、模型强度、目录选择、重命名、删除确认、连接关闭与重连、浅深主题和宽窄布局。截图保存在 `.cache/codex-ui/`。

审批响应按 Codex 官方 app-server JSON schema 核对，命令与文件审批使用 `{decision}`；回归仅使用假进程和消息，不发送真实账户或付费请求。运行包只包含本插件资源和 MIT 许可，不包含 SDK 运行时或宿主源码。

## 许可

MIT，见 [LICENSE](LICENSE)。不打包 `lumi-sdk.js`（由宿主提供）。
