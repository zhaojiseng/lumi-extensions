# 本地录制网关：上游源码研究记录

- 查阅日期：2026-10-10（Asia/Shanghai）。
- 来源：用户指定的官方仓库 `yetone/magpie`、`farion1231/cc-switch`。
- 方法：通过 GitHub HTTPS 浅克隆，只读检查固定 HEAD 的文档、许可证、实现和测试源码。缓存位于本仓库忽略的 `.cache/gateway-research/`；没有执行上游程序、上游测试或真实 AI 请求。
- 本文件区分“源码显示的行为”与“本项目选择”。不能把上游已有功能或已有测试解释为 Lumi 已完成或已验证的功能。

## 1. 固定来源与许可

| 项目 | 完整提交 SHA | 提交时间 | 实际查阅的清单/许可证 |
| --- | --- | --- | --- |
| Magpie | `d81706f974681d844cd378003d30baf6e10145b1` | 2026-10-10 15:17:13 +08:00 | [go.mod](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/go.mod)、[LICENSE](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/LICENSE)：MIT，Copyright (c) 2026 yetone |
| CC Switch | `eda410e57b4659d6bbb2a10a069d8bac2213099a` | 2026-10-10 16:34:21 +08:00 | [package.json](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/package.json)、[Cargo.toml](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/Cargo.toml)：4.0.6；[LICENSE](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/LICENSE)：MIT，Copyright (c) 2025 Jason Young |

两份根 LICENSE 的 MIT 条款均要求复制品或实质部分包含版权和许可文本。本轮只形成架构事实摘要与路径引用，没有把上游实质源码复制到 Lumi 实现。未来若复用源码，必须附完整上游 LICENSE、固定来源和修改归属，并逐项核查实际打包依赖的 LICENSE/NOTICE；根 MIT 许可不替代第三方依赖许可审计。

Lumi 已有 CC Switch 归属记录仍可保留：[THIRD_PARTY_NOTICES.md](../../main/THIRD_PARTY_NOTICES.md)、[随附许可](../../main/public/third-party/cc-switch-LICENSE.txt)。本次已直接核对上面固定 SHA 的 CC Switch 根许可证，其内容与现有 MIT 归属一致。

## 2. Magpie：网关、录制与配置

Magpie 的网关主体是 Go `net/http` 服务，不是 Lumi 沙箱插件式的 Node 服务。核心 `Server` 集中处理路由、供应商选择、协议转换和转发；JavaScript middleware 在网关进程内运行，和由 Bun 宿主执行的 provider 插件分开。以下是本次实际读到的实现位置。

| 环节 | 固定源码证据 | 源码事实 |
| --- | --- | --- |
| 监听与停机 | [gateway.go:43](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/gateway.go#L43)、[ListenAndServe:396](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/gateway.go#L396) | 默认地址为 `127.0.0.1:3425`；上下文结束调用 HTTP Shutdown，普通关闭与 handover 使用不同宽限期。项目另有 LAN 模式，默认地址不表示所有配置都限定 loopback。 |
| 协议入口 | [Handler:481](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/gateway.go#L481)、[responsesOverHTTP:548](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/gateway.go#L548) | 注册 Chat Completions、Responses、Anthropic Messages、Gemini 等接口；GET Responses 的 WebSocket 升级入口有明确 HTTP 回退响应。不能将接口列表理解为本项目已经兼容这些协议。 |
| 访问身份 | [lanGuard](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/lan.go#L234)、[身份转换](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/lan.go#L341) | 区分本机与远程、代理/隧道和浏览器 DNS 重绑定；远程或 managed-key 调用进入 caller 身份核验，认证后替换入站凭据供内部处理。某些普通 loopback 请求可以无 managed key 进入，不能把其默认本机策略照搬为 Lumi 的每客户端密钥要求。 |
| 请求限制 | [request_bounds.go:17](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/request_bounds.go#L17)、[readBoundedRequestBody:96](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/request_bounds.go#L96) | 对编码后的请求体进行解码读取、大小限制和读取超时限制；解码后的字节同样受限。 |
| middleware 顺序 | [serveAgent](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/middleware.go#L15)、[Run.Request](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/middleware/run.go#L116) | 客户端录制包装在 middleware 外；请求依次执行 `onRequest`，再进入供应商处理；自身辅助请求绕开该入口。middleware 异常/超时保留原请求，属于 fail-open 设计。 |
| 流式与旁路抓取 | [capture.go:13](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/capture.go#L13)、[capture.go:133](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/capture.go#L133)、[passthrough](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/gateway.go#L3057) | Recent-call 诊断正文只保留首 256 KiB并标记截断；响应 writer 边记录边写回，保留 Flush；需要更长正文时使用临时 spool。`passthrough` 内仍有供应商适配，名称不意味着原始请求字节完全不变。 |
| 本地会话录制 | [recordConversation](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/conversations.go#L61)、[conversationTurn](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/conversations.go#L122)、[说明](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/docs/subsystems/gateway-sessions.md#L55) | 需显式打开录制，且客户端提供会话 ID；记录客户端侧一次 exchange，而非每个上游重试；正文经 ScrubJSON 后规范化为会话内容。不能恢复隐藏推理、客户端本地行为或未经过网关的内容。 |
| 保存与清除 | [sessions/gateway.go:27](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/sessions/gateway.go#L27)、[SaveGatewayTurnGeneration](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/sessions/gateway.go#L72)、[SetGatewayRecording](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/sessions/gateway.go#L192) | 按 UTC 日期和身份哈希保存 JSONL；读取保留期 7 天，正文库软上限 256 MiB；停用/清空增加 generation，保存时复查，防止旧在途请求重新填充清空库。该机制不是本项目 SQLite/AEAD 已实现的证据。 |
| 原始请求归档 | [archive.go:3](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/archive.go#L3)、[archive.go:173](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/archive.go#L173) | 与本地规范化会话录制是另一项功能：显式启用后，将脱敏的请求/响应和头归档到配置的 bucket；有临时 spool、16 个等待任务的队列和大小/截断标记。涉及上传，不采纳到 Lumi 的默认本地录制路径。 |
| Codex 配置所有权 | [agent/codex.go:516](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/agent/codex.go#L516)、[codexMoveGateway](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/agent/codex.go#L1344) | 对其写入的网关地址保存所有权标记，关闭对应功能时只撤销自己拥有的配置；另外处理地址迁移和 CC Switch mirror。不是对任意现有 CLI 配置无条件覆盖/回滚。 |

### Magpie 的 service_tier 实际行为

- [请求中间表示](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/ir.go#L160) 保存 `Tier`、`Fast`、`Ultrafast`、`OwnTier`；[Responses 解析](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/responses.go#L211)读取该字段。
- [Responses 构造](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/responses.go#L880)按 host 和标记写入 tier：Fast 到 OpenAI 官方后端写 `priority`，Ultrafast 在 ChatGPT 后端写 `ultrafast`，用户自定义地址的 `OwnTier` 可以保留非空原 tier；[Chat 构造](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/chat.go#L418)也有按 host 的行为。
- [withFast](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/groupfast.go#L15)可给 Chat/Responses 注入 `priority`；这是供应商速度功能，不等同于 Lumi 所需的通用四模式规则。
- [codexBody](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/provider/codex_request.go#L238)针对 ChatGPT Codex 后端保留 `priority`/`ultrafast`，删除其他 tier。此处是该项目的后端适配，不是 OpenAI 公共 API 通用枚举声明。
- [optionalFields](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/gateway.go#L3905)包含 `service_tier`；源码区分“字段不支持”和“值非法”。[own_tier_test.go](https://github.com/yetone/magpie/blob/d81706f974681d844cd378003d30baf6e10145b1/internal/gateway/own_tier_test.go#L65)明确断言字段被拒后删除再请求、并记住后续省略；本次阅读了这些断言，但没有执行测试。

因此不能直接移植该项目的 tier 策略：Lumi 保持显式四模式、原值/发送值/报告值分离；上游拒绝 tier 时返回真实错误，不自动删字段或降档重发。上游 `ultrafast` 等字符串也不能自动成为 Lumi 全路由白名单。

## 3. CC Switch：代理、用量与客户端配置

CC Switch 采用 Tauri 桌面应用与 Rust 本地代理，`ProxyServer` 使用 Tokio listener、Hyper 和 Axum router；请求上下文、供应商选择、forwarder、协议变换、响应解析和 SQLite 用量记录分层。它的当前配置机制已从旧 `proxy_live_backup` 逻辑迁移到 mode/live 操作层，不能只参考旧版接管文件名。

| 环节 | 固定源码证据 | 源码事实 |
| --- | --- | --- |
| 监听与路由 | [server.rs:102](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/server.rs#L102)、[build_router](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/server.rs#L299) | 从代理配置绑定实际 listener，报告实际端口；注册 Messages、Chat、Responses 等协议路径。配置可使用非 loopback 地址，本项目不继承该开放范围。 |
| 请求分层 | [handlers.rs](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/handlers.rs)、[handler_context.rs](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/handler_context.rs)、[forwarder.rs](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/forwarder.rs) | 路由处理、上下文和上游发送位于独立模块；另有模型映射、供应商适配、熔断和故障转移。这里仅作为边界组织参考，不继承自动故障转移或协议转换。 |
| 上游认证头 | [forwarder.rs:2450](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/forwarder.rs#L2450) | 普通路径丢弃客户端认证头并换成 adapter 提供的上游认证头；另有 Codex 官方账号认证透传特例。Lumi 首版只采纳显式本地客户端密钥与上游凭据分离，不能把透传特例扩展到所有路由。 |
| SSE 透传与统计收尾 | [handle_streaming](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/response_processor.rs#L161)、[SseUsageFinishGuard](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/response_processor.rs#L461)、[sse.rs](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/sse.rs) | 使用上游 byte stream 构造 Axum streaming body，同时收集 SSE 用量；Drop guard尝试在提前释放时完成用量收尾。它不证明异常结束一定有完整 usage。 |
| 记录库 | [RequestLog](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/usage/logger.rs#L61)、[SQL 写入](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/usage/logger.rs#L169) | `proxy_request_logs` 存供应商、客户端、模型、usage、成本、耗时、可选首 token/session、状态等；该结构未包含原始请求/响应正文，不能把这条用量记录路径称为全文录制。 |
| 代理服务配置变更 | [ProxyService](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/services/proxy.rs)、[重启恢复](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/services/proxy.rs#L546) | 服务启停与配置管理分开；监听参数变更失败时尝试恢复原配置及原服务。应用连接 origin 与监听 all-interface 地址也有独立处理。 |
| CLI 模式进入/退出 | [enter](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/mode/controller.rs#L577)、[exit](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/mode/controller.rs#L721)、[Codex projection](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/live/project/codex.rs#L592) | mode controller负责进入/退出代理模式，工具各有 live projection；Codex使用 TOML 文档修改，按字段所有权处理已写值，而非把整个配置文件替换成新模板。 |
| 配置事务与恢复 | [live/engine.rs:127](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/live/engine.rs#L127)、[首次备份](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/live/engine.rs#L158)、[operation.rs:65](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/mode/operation.rs#L65)、[recover](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/mode/operation.rs#L208) | 先读当前字节并计算计划和摘要，再 stage、提交、保存 pending 操作；有应用写锁、首次字节备份和冲突/恢复处理。读取到的是私有权限文件备份，不能据此宣称其备份均已加密。Lumi继续复用自身加密备份事务。 |

### CC Switch 的 service_tier 实际行为

- [Provider 类型](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/provider.rs#L554)和前端 [CodexOAuthSection](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src/components/providers/forms/CodexOAuthSection.tsx#L397)有 Codex OAuth FAST 设置。
- [anthropic_to_responses](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/providers/transform_responses.rs#L1775)接受 `is_codex_oauth` 和 `codex_fast_mode`；[实际注入点](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/providers/transform_responses.rs#L2008)仅在两条件成立时给转换后的 Responses 请求写 `service_tier="priority"`。同处分支还改变 store/include/stream等协议字段；不是对所有入站请求只修改一个顶层字段。
- [对应测试源码](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/providers/transform_responses.rs#L5121)有开关和非 Codex 路径的断言，本次未运行。
- [Responses→Chat 转换字段表](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/providers/transform_codex_chat.rs#L29)包含 `service_tier`；[拷贝字段入口](https://github.com/farion1231/cc-switch/blob/eda410e57b4659d6bbb2a10a069d8bac2213099a/src-tauri/src/proxy/providers/transform_codex_chat.rs#L334)把这些字段放入转换结果。这是协议转换中的保留字段机制，不是四模式规则引擎。

本次查阅已证明其有明确的 tier 注入和转换保留路径；没有在本次阅读范围内证明它提供 Lumi 所需的通用 `preserve/remove/set-if-missing/override` 规则或 original/effective/reported 三值录制。不能把未发现解释为对整个仓库不存在该功能的证明。

## 4. Lumi 的采纳、调整与不采纳

| 来源思路 | 决策 | 对 Lumi 的具体影响 |
| --- | --- | --- |
| Magpie 客户端侧录制包裹网关处理 | 调整采用 | 同时明确客户端原值、上游实际发送值与响应报告值；不能只录转换后的请求冒充原请求。 |
| Magpie 有界正文捕获、截断状态、临时 spool | 采用边界思路 | 录制有大小/队列限制并报告不完整；实现与数据库格式独立编写，SSE 转发不等待全文。 |
| Magpie 显式本机录制开关、generation 清空保护 | 采用边界思路 | 正文默认关闭；停用/删除范围可阻止在途写回；脱敏不保证移除任意自然语言秘密。 |
| Magpie tier按供应商改写、删除拒绝字段并重试 | 不采纳 | 显式四模式决定发送值；上游拒绝原样回传，不降档重发，避免掩盖策略与执行/费用结果。 |
| Magpie 云 bucket归档与 OTLP 导出 | 不采纳默认路径 | 请求正文仅本地专用记录库；导出是用户发起的受限操作。 |
| CC Switch 分层代理、SSE旁路用量与终态收尾 | 调整采用 | 网关、管理、录制、规则分层；终态与观测完整性分别记录，缺失 usage 保持未知。 |
| CC Switch配置投影、摘要冲突检查、pending恢复 | 采用边界思路 | 复用 Lumi 已有预览/加密备份/原子应用/冲突回滚；不移植其用户目录写入能力给插件。 |
| CC Switch Codex OAuth FAST路径与跨协议转换 | 不采纳为首版基础 | 首版是声明的公共API原协议路由；`priority`等值来自路由能力核验，不能用订阅后端说明代替公共API契约。 |
| 两项目可扩展的网络/插件权限 | 不采纳其权限范围 | Lumi 沙箱插件通过受限具名宿主桥接；数据与管理仅 loopback、令牌和实例身份分离，不开放任意本机URL/进程。 |

## 5. 未知与后续验证

1. 本次是静态源码研究，没有执行两个上游项目的测试、GUI、实际 SSE 或 CLI 接管；测试文件只是设计和断言证据。性能、跨平台行为和安全性须由 Lumi 自己的模拟上游与真实桌面回归证明。
2. 固定提交不等同于两个项目最新公开 Release；本记录未核对其安装包、签名或发布时间，不从 HEAD 推断发行状态。
3. OpenAI 公共 Responses/Chat Completions 的字段枚举、模型/账户适用范围、缺省和响应语义必须单独用官方文档核验。本文中的 `priority/ultrafast/flex` 是实际源码字符串或测试样本，不是平台官方支持值承诺。
4. 本研究覆盖网关关键链路和已定位的 tier/配置/录制路径，不是两个大仓库的完整安全审计，也不是所有实现分支均已穷尽。
5. 未来接纳任何实质源代码前，更新源码来源、许可和复用清单。新增依赖必须检查完整许可；不执行上游安装脚本或通过真实账户发测试请求来替代模拟验证。
