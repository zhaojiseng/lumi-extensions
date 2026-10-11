# 本地录制网关核心与开发回归

此目录保留 Rust 核心及隔离开发回归。当前用户交付采用 **Lumi 内置网关运行资源**：主程序 `main/native/gateway-runtime` 构建固定 Rust release 核心，安装包携带 `resources/native` 二进制；HTTP/SSE 与 TLS 管理由 Electron 主进程的 Node 内置模块提供。用户无需另外安装 Node、Rust、服务程序，执行终端初始化，编辑配置文件或导入配对文件。

插件仍位于 [package-stage](../extension.lumi.gateway/package-stage)，只含六项 Web 运行资源和完整 MIT 许可。用户在匹配的本地 Lumi 构建中完成首次设置、端口/limits、路由增删、认证更换、规则、录制与 CLI 事务。安装及界面说明见 [插件 README](../extension.lumi.gateway/package-stage/README.md)。尚未公开发行，公开最低宿主版本待兼容宿主发布后确定。

## 已实现

- OpenAI Responses/Chat 与 Anthropic Messages 原协议 HTTP/SSE；固定路由、双认证替换、实时转发、背压、取消、超时、请求大小与并发限制，不跟随重定向、不自动重试或降档。
- 顶层 `service_tier` 四模式 preserve/remove/set-if-missing/override，保留其他原始字节和大整数；null 不算缺失。原值、实际发送值、真实响应报回值分别记录，自定义 token 合法不保证上游支持，不隐式映射 fast/priority 等值。
- 路由新增、编辑、删除、启停及双认证更换；1–32 条，至少保留一条。新路由需要两项认证，旧路由未提交字段保持；修改前停止监听并等待在途请求结束。
- 默认元数据；正文明确开启后按已知字段脱敏并 AES-256-GCM 加密。Windows DPAPI 已实际测试；macOS Keychain 实现待 ARM64 本机验证；Linux 无明文回退。
- 固定 TLS 管理协议 v1：实例身份、标准证书校验与 SHA-256 指纹、令牌、Host/Origin、监听 owner、配置版本冲突、正文分页/游标撤销和删除 tombstone。
- 生产上游仅公共 HTTPS；启动及每次请求检查全部 DNS 地址、固定当次连接地址并校验原域名 TLS 身份。页面 fixture 的本机假上游通过构造器专用测试入口启用，不由插件参数放开。
- 名称、数据/管理端口、请求上限和并发均在页面设置；端口占用后可直接修改并保留认证。运行资源随 Lumi 生命周期关闭。
- 上游模型目录：已保存 OpenAI/Anthropic 路由固定 GET，无需数据监听，使用已有认证，不发送推理或生成录制。最多 500 项、五页、总 1 MiB/12 秒，每 ID 256 UTF-8 字节；公共 DNS 固定连接与 TLS 验证，有限错误码、配置/连接撤销保护和独立两项并发。目录不保证推理、价格或 tier 兼容。
- 客户端模型目录：监听后支持 `GET /<routeID>/v1/models`；完整配置仅一条已保存路由时兼容 `GET /v1/models`，多条或其他禁用路由均不自动选择。沿用路由客户端鉴权并使用已保存上游认证，复用目录公共 DNS/TLS/分页检查；返回有限 OpenAI 列表及显式截断标记，最多 128 KiB。目录占共享请求限额，正常 drain 可完成，取消或退出中断，不进入核心推理与录制方法。

## 固定私有命令

以下是宿主实现协议，**不是用户操作步骤**。路径与二进制由宿主固定，不来自插件；命令只允许私有进程管道，认证不放入命令行或普通日志。

| 命令 | 输入 | 返回 |
| --- | --- | --- |
| `initialize-private <NEW绝对目录>` | `{config,routeSecrets:[{routeId,clientKey,upstreamKey}],management?}` | `{configVersion:1}` |
| `configure-private <现有目录>` | `{expectedVersion,config,credentials?:[{routeId,clientKey?,upstreamKey?}],management?:{alias,port}}` | `{configVersion:N+1}` |
| `serve-engine <现有目录>` | bootstrap 一次后调用固定核心方法 | 有界 JSON 结果或安全错误码 |

初始化/配置 stdin 为 EOF 结束的单个 JSON，最多 256 KiB，严格 UTF-8，拒绝重复键、未知字段和无效认证。初始化拒绝已有目录；配置检查持久版本，保留录制密钥、未改认证及管理证书/令牌。OS 保护备份和无秘密事务日志在失败或中断后恢复，原子配置提交作为事务完成点。宿主串行化同实例写入并等待核心实际退出，才执行私有配置。

bootstrap 含数据面所需秘密，只在固定子进程与主进程私有管道中转移，不返回 SDK 或网络管理端。SDK 的 `gateway.local.status/setup/configure` 与 `gateway.routes.save/delete` 提供严格界面操作；认证只提交、不回显。`gateway.routes.config.get/set`、规则、录制、记录、监听、事件和 CLI 方法见 [桥接说明](../../docs/GATEWAY_HOST_BRIDGE_PROPOSAL.md)。

历史 `init`、`protect-management` 及 `dev/run*.mjs` 保留为开发工具，不能作为本版用户安装文档或独立伴随服务要求。标准运行数据目录只由宿主管理；开发夹具均使用新的隔离目录与假认证。

## 开发环境与验证

仅开发者需要 Node.js 24+、npm 11+、Rust stable 与相应 C/C++ 工具链。本机 Rust 1.97，锁定 Cargo 依赖。在独立插件仓库根目录运行：

~~~powershell
npm.cmd run check:gateway
npm.cmd run check:gateway-host
node sources/extension.lumi.gateway/scripts/check-integration-ui.mjs ..\main
node sources/extension.lumi.gateway/scripts/check-chromium-ui.mjs
~~~

`check:gateway` 执行 Rust 测试、严格 clippy、核心及隔离 fixture 构建和 Node 回归；`check:gateway-host` 检查相邻主程序实际类型及网关测试。Cargo 可复用 `.cache/gateway-cargo/config.toml` 的本地缓存，开发输出位于 `.cache/gateway-target`，不进入插件包。主程序 `npm.cmd run build` 调用其内置核心 Cargo release 构建与完整依赖许可生成。

本轮客户端模型目录的 Node **86** 项全过，新增数据目录 12 项及真实 TLS 数据 GET 6 项；日志 `.cache/gateway-default-ui/runtime-node.log`。Rust 本轮未改，前次 **90** 项及严格 clippy 通过记录保留为历史。实际主程序全量 **848** 项中 **845** 通过、**3** 项平台相关跳过；真实沙箱 Electron 使用本次安装包 `resources/native` 核心完成 **103** 次 SDK 调用、**10** 组流程、**27** 张截图、**60** 项默认元素对照和 **24** 项四页布局检查，结果为 `.cache/gateway-plugin-ui/real-electron-Tszb5i/result.json`。本地完整 Windows 安装包校验匹配 78 文件，含 65 项 npm 与 84 项 Rust 完整依赖许可。日志、SHA-256、截图和范围见 [验证记录](../../docs/GATEWAY_VALIDATION.md)。

所有模型请求只到固定本机假上游，保留测试 CA 校验；CLI 只用隔离 TOML/JSON fixture。未使用真实凭据、修改用户实际 CLI 配置或发起付费请求。Windows 结果不代替 macOS、Linux CI、真实工具/提供者或公开发行。

## 规则示例

用户在页面保存规则，以下 JSON 仅供开发者理解核心结构。操作发生于网关实际请求，不改 CLI 本地 `service_tier`：

~~~json
{"id":"priority-for-responses","enabled":true,"priority":10,"match":{"routeId":"primary","endpoint":"/v1/responses"},"action":{"type":"override","value":"provider_custom-2026"}}
~~~

按优先级、匹配范围具体程度和数组顺序选择唯一首条；模型匹配使用原始 model。新规则只影响后续 prepare，在途请求继续使用已冻结发送字节。上游拒绝时原样回传，不自动删字段、降档或重发。

## 当前界限与发行门槛

- 正文捕获前 1 MiB/4096 段，完整流继续转发。独立 SSE 观察单行 64 KiB、事件 256 KiB，可观察捕获上限后的真实末尾 usage/tier；观察超过 1 秒未响应则放弃并继续转发，字段保持未知。正文截断与观察失败分别处理。
- 容量限制为元数据 UTF-8 和加密 payload 的逻辑量，不等于 SQLite/WAL 物理大小；筛选最多扫描 10000 条，超限显式拒绝。没有全库聚合统计、全文检索、WebSocket/Upgrade 或重放入口。
- 脱敏不保证识别自然语言中的全部秘密；正文需明确启用，导出仅元数据。应用日志不含正文或凭据。
- CLI 接管只改固定入口和认证，保留模型、本地 `service_tier` 及其他字段；真实 Codex/Claude CLI 版本、模型/项目权限和提供者兼容待实测。
- Windows 本地内置资源、GUI 路由/认证管理及完整包内许可已验证。macOS ARM64 Keychain/原生包、Linux CI、证书轮换、安装升级与公开版本兼容尚待完成，不宣称签名或跨平台公开发行。
- Magpie/CC Switch 固定源码与根许可证已核验，[研究记录](../../docs/GATEWAY_REFERENCE_RESEARCH.md) 未复制其实质代码；官方 tier 语义见 [字段核对](../../docs/GATEWAY_OFFICIAL_TIER_REFERENCE.md)。

正式发行先公开实际包含新接口的 Lumi 并核验附件，再更新独立插件固定宿主、SDK 和最低公开产品版本，按两个仓库分别发布。插件 ZIP 不携带二进制、SDK、测试输出或用户数据，不要求另行安装伴随服务。
