# 2026-10-11 插件发布验证

本轮版本：浮梦 · 梦幻界面 `1.1.9`、模型网关 `1.0.2`、工作台便笺 `1.0.1`。三个插件分别打包、打标签和发布；未修改的 Codex 和紧凑界面不重复发布。网关最低宿主仍为 Lumi `1.0.1`，固定官方包校验器仍来自 `host.json` 指定的公开版本。推荐配合 Lumi `1.0.2`，以包含本轮主程序的模型选中控件折射修复。

以下检查于本轮发布准备期间重新执行，不沿用此前开发记录。真实界面使用相邻 `main` 的 Lumi `1.0.2`、Windows x64 和隔离假数据；没有访问实际用户存储、CLI 配置、真实账户或付费接口。Electron 进程沙箱保持开启。

| 命令与范围 | 本次结果与证据 |
| --- | --- |
| `npm.cmd run check` | 固定官方校验器检查全部五插件通过，包含三个新版本；日志 `.cache/release-check.log` |
| `node --test scripts/check-notes.mjs sources/extension.lumi.gateway/tests/record-refresh.test.mjs` | 最终 18/18 通过：便笺 9 项、网关 9 项；覆盖延迟读取、串行保存、失败重试、事件合并、慢请求、乱序响应、选择保护、切页和失效会话；日志 `.cache/release-records-notes-tests.log` |
| `npm.cmd run check:notes-ui -- ../main` | 官方 SDK、真实 Electron DOM 和隔离假存储 8 检查通过，30 次连续保存合并为一个串行后续写入，最大并发写入 1；浅深两张截图；`.cache/notes-ui/result.json` 与 `run-8s4bB0/`，日志 `.cache/release-notes-ui.log` |
| `node sources/extension.lumi.gateway/scripts/check-simplified-ui.mjs ../main` | 21 组既有流程、5 组资源回归及浅深 / 1280、600、480 px 六场景通过；`.cache/gateway-plugin-ui/run-o8pasZ/result.json`，日志 `.cache/release-gateway-simplified-ui.log` |
| `node sources/extension.lumi.gateway/scripts/check-integration-ui.mjs ../main` | 记录刷新竞态修复后最终复验通过：25 组真实宿主流程、24 项视图、26 项概况检查、67 张截图，错误和意外网络为空；`.cache/gateway-plugin-ui/real-electron-qBF8fL/result.json`，日志 `.cache/release-gateway-integration-ui-final.log`；修复前首轮结果保留于 `real-electron-AV8vMk/` |
| `npm.cmd run check:dreamy-ui -- ../main` | 完整软件回归通过，覆盖浅深主题、弹窗开关实际像素、退出清理、减少动态效果、原生下拉、多选、窄窗口和四组减少透明度／强制颜色回退；`.cache/dreamy-ui/result.json`，日志 `.cache/release-dreamy-ui.log` |
| `npm.cmd run check:dreamy-ui -- ../main --refraction-only --hardware` | 6 组实际工作区、2 组模型卡片、3 档折射及 2 组文字透镜检查通过；`.cache/dreamy-ui/result-refraction-gpu.json`，日志 `.cache/release-dreamy-refraction.log` |
| `npm.cmd run check:dreamy-controls-ui -- ../main` | 6 组浅深／透明度场景、实际透镜像素、滑块交互和余额不透明回退通过；日志 `.cache/release-dreamy-controls.log` |
| `npm.cmd run check:dreamy-settings-ui -- ../main` | 浅深色、轻柔／适中／强烈及三种窗口大小共 18 场景通过，正文滚动、固定标题与边界正常，前景清晰度比值均为 1；日志 `.cache/release-dreamy-settings.log` |
| 网关资源同步、空白检查 | `package-stage` 与 `plugins/extension.lumi.gateway` 七项资源逐字节一致；`git diff --check` 通过 |

网关资源检查本次观测到闲置轮询间隔 745、1601、3207 ms，活跃连续两次读取耗时 1559 ms；已完成卡片内容和 SVG 连线几何重复 mutation 均为 0。切页停止插件快照轮询，返回立即恢复；活动模型切换保留目录焦点与路径节点；可见卡片容量由 5 降至 2 后选中项和详情仍一致。隐藏状态使用覆写 `document.hidden` 与 `visibilitychange` 的模拟，未冒充操作系统最小化测试，也未测量进程级 CPU/RSS。

网关集成包含真实 ExtensionHost、ExtensionFrame、preload、SDK、TLS 管理端、系统安全存储与 Rust 核心。核心来自 `main/dist-native/lumi-gateway-runtime.exe`，SHA-256 为 `e930b928a9486f97fed5a96c7e8f36a6f78edc9e33db998a54593f37214d94b9`。集成夹具未修改宿主源码。

发布审查补充修复网关记录刷新竞态：较旧的自动读取失败时，如果新的手动读取和记录事件已经推进请求代次，最后释放在途请求后仍需补调度。新增确定性回归先复现失败，再确认修复后 9/9 网关测试通过；保留“当前自动读取失败且没有新事件时不无限重试”的既有检查。两个目录包资源同步修改。

本轮目视检查了便笺浅色、网关窄屏深色、梦幻工作区浅色与窄屏深色设置截图。Windows 本地结果不替代 macOS/Linux 运行验证；公开发布状态及 ZIP/SHA-256 验收由发布步骤记录，不将本页本地通过等同于已公开。
