# 模型网关的受限宿主桥接说明

日期：2026-10-11。状态：用户已批准完整受限桥接、固定 CLI 事务、内置运行资源、上游模型目录检测及客户端模型目录 GET；Windows 本地全界面流程完成。“模型网关”重命名与布局、操作逻辑优化在独立插件完成，不增加接口或权限。用户另明确批准主程序兼容 Cherry Studio 的相同有效双认证头并重新编译本地 EXE，冲突或重复头仍拒绝；现有配置沿用。本次 `0.1.0-dev.4` 的路由与规则列表、搜索筛选及折叠编辑只更新插件，直接使用前次宿主。未提交、推送或公开发布。计划见 [v0.9 计划书](LOCAL_RECORDING_GATEWAY_PLAN.md)，证据见 [验证记录](GATEWAY_VALIDATION.md)。

## 1. 宿主职责与用户路径

外部插件运行沙箱 Web 资源，不能自行监听端口、连接 localhost、启动进程或读取记录库。因此网关使用既有 `extensionRequest` 增加严格的具名接口。插件保持 iframe `sandbox=allow-scripts`、`connect-src 'none'`，不扩大 `network.read`，不开放任意 shell、IPC、路径、SQL 或目的 URL。

Lumi 主进程内置 HTTP/HTTPS 数据面与 TLS 管理服务，使用 Electron 自带 Node 模块；安装包 `resources/native` 提供固定 Rust 核心。生产源码位于 `main/native/gateway-runtime`，Cargo release 构建随主程序打包并生成完整 Rust 依赖许可。插件仍是独立六项 Web 资源目录包，SDK 由宿主提供。

用户通过插件页面设置名称、数据/管理端口、请求大小、并发、公共 HTTPS 路由和写入式认证；可新增、编辑、删除路由及更换认证。宿主自动创建实例、证书、令牌和系统保护存储。用户无需外部程序、终端初始化、配置文件编辑、证书生成或配对文件。端口占用后可在页面修改并保留已保存认证。旧 `gateway.pair` 仍为受限兼容能力，不是本插件主流程的前置步骤。

## 2. 固定运行资源与私有命令

宿主固定二进制位置及每插件的应用自有数据目录；这些值不来自渲染器。命令不经 shell，认证仅经私有 stdin，原始输入及 stderr 不转发到插件或普通日志。

| 固定命令 | 私有输入 | 安全输出 |
| --- | --- | --- |
| `initialize-private <NEW绝对目录>` | `{config,routeSecrets:[{routeId,clientKey,upstreamKey}],management?}` | `{configVersion:1}` |
| `configure-private <现有目录>` | `{expectedVersion,config,credentials?:[{routeId,clientKey?,upstreamKey?}],management?:{alias,port}}` | `{configVersion:N+1}` |
| `serve-engine <现有目录>` | 固定 JSON 方法白名单；首次 bootstrap 将必要认证转移到主进程私有数据面 | 后续只返回具名结果；bootstrap 不出现在 SDK、网络管理接口或日志 |

初始化/配置单消息最多 256 KiB，严格 UTF-8、无重复键、无未知字段。配置持久 `configVersion`，旧配置缺省 1；配置更新检查磁盘版本，冲突不写入。新路由需要两项认证，删除同时删除对应凭据；不改录制密钥、未更新认证或管理证书/令牌。认证限定可打印 ASCII，客户端认证至少 16 字符，最多 8192；名称最长 100 个 UTF-16 单元，无控制字符。

初始化拒绝现有目录，不覆盖已配对身份；失败只清理本次创建的固定文件。更新使用系统保护的备份、无秘密事务日志及原子配置提交；`serve-engine` 和下一次配置在启动前恢复未完成事务。Windows DPAPI、macOS Keychain 不提供明文降级。宿主同实例串行操作，等待数据监听、在途请求和核心实际停止后才执行私有配置；离线端口故障可从界面修复。

## 3. TLS、owner 与生命周期

数据与管理端口分离，仅 loopback；界面端口为 1024–65535 且不能相同。管理固定 `/management/v1/*`，采用标准 TLS、持久证书及 SHA-256 指纹，确认登记实例后才发送令牌。身份不匹配或端口被其他服务占用立即失败；不全局关闭 TLS。网络信封协议为 1，与扩展 API 版本分开。

数据监听固定 `GET /<routeID>/v1/models`，完整配置恰好一条路由时支持裸 `GET /v1/models`；其余推理路径仍带路由前缀。目录使用对应客户端认证和已保存上游认证，不转发调用者 URL、查询、Cookie 或任意请求头。复用模型目录公共 DNS、固定 TLS、分页与限额检查，返回 `{object:'list',data:[{id,object:'model'}],lumi_truncated}` 及 `x-lumi-models-truncated`，最多 128 KiB。占共享请求并发、正常排空保持成功响应、取消与配置替换撤回，不调用核心 prepare/observe/finish，不产生 AI 记录。

客户端 OpenAI 路由沿用 Bearer；Anthropic 路由接受 `x-api-key` 或 Bearer。若两种头同时存在，各自必须只出现一次并严格匹配同一保存的客户端密钥；空值、冲突值、错误值或重复头仍返回 401。此兼容处理不扩大目的地址或权限，不改变 Host/Origin 校验，也不把客户端认证转发到上游。

管理会话绑定插件 ID、generation、view 与实例；监听操作验证 owner，拒绝抢占或停止他人监听。管理端校验 Host、Origin、方法、协议、身份和参数。路由上游仅公共 HTTPS，无 URL 凭据、查询或 fragment；启动及每次连接验证全部 DNS 地址，并固定连接地址、校验原域名 TLS。

视图退出仅撤销该视图会话、订阅与迟到详情，保持用户启动的监听。generation 失效、停用、包不兼容或摘要变化撤销旧权限并停止所属托管资源。退出 Lumi 关闭其数据监听、管理服务与核心进程；托管资源不在 Lumi 退出后作为独立服务继续运行。主动停止拒绝新请求，限定排空或取消；断流标记执行未知，不自动重发。

监听停止不等于 CLI 已恢复。页面“恢复入口并停止”先成功恢复再停止，失败保留监听；仅停止提示 CLI 仍可能指向原地址。停用后的恢复事务由宿主原生入口保留。远程兼容实例不可达时继续保留待撤销意图，下一次认证连接先撤销；不能把离线状态写成已停止。

## 4. 权限、完整方法白名单与 DTO

所有接口复用固定 `extensionRequest` 的 id、generation、view，主进程再次校验权限、owner 和严格 Zod schema。下表名称均带 `gateway.` 前缀；未列方法拒绝。

| 权限 | 方法 | 输入与返回边界 |
| --- | --- | --- |
| `gateway.control` | `status`、`pair` | 状态只返回别名、协议、连接/监听摘要；兼容配对由宿主自有入口完成 |
| `gateway.control` | `local.status` | 无参数；配置/运行状态、名称、端口、版本、大小/并发及安全错误码，无认证 |
| `gateway.config` | `local.setup` | 名称、端口、大小/并发、首条 RouteInput、两项 CredentialsInput；返回 pairingId/configVersion |
| `gateway.config` | `local.configure` | expectedVersion、名称、端口、大小/并发；返回新版本，保留认证 |
| `gateway.control` | `connect`、`disconnect` | pairingId 可省略以连接托管本机实例；返回/撤销不透明 sessionId |
| `gateway.control` | `listener.start`、`listener.stop` | sessionId、固定 drain/cancel；只操作所属监听，返回实际状态与活动数 |
| `gateway.control` | `events.subscribe`、`events.unsubscribe` | sessionId/subscriptionId；摘要或固定警告，不推送正文或密钥 |
| `gateway.config` | `routes.config.get`、`routes.config.set` | 路由读取 DTO 与版本；旧设置接口只改已有固定凭据引用的路由元数据 |
| `gateway.config` | `routes.save`、`routes.delete` | sessionId、expectedVersion、RouteInput/可选写入式认证或 routeId；托管实例增删/更换认证，返回版本 |
| `gateway.config` | `routes.models.detect` | sessionId、routeId、expectedVersion；使用已保存路由/认证，仅固定目录 GET，返回版本、时间、最多 500 个 UTF-8 限长模型 ID 与 truncated；无推理或录制 |
| `gateway.config` | `rules.list`、`rules.preview`、`rules.replace` | 规则与版本、纯字段状态预览或严格规则替换；预览不接收正文或发送上游 |
| `gateway.config` | `recording.config.get`、`recording.config.set` | 正文开关、保留期、容量、记录数、捕获量及版本；返回加密可用状态 |
| `gateway.records.read` | `records.list`、`records.get` | 有界筛选/游标摘要页与按需正文页；不接受 SQL |
| `gateway.records.manage` | `records.delete`、`records.export` | ID 列表或截至时间筛选；tombstone；导出仅元数据，宿主对话框选路径 |
| `gateway.cli-config` | `cliConfig.preview`、`cliConfig.apply`、`cliConfig.restore` | 固定工具/路由预览、事务 ID/指纹应用与恢复；不接收文件路径或任意 patch |

读取 RouteDto 仅含 id、clientAlias、protocol、固定 upstreamBase、credentialRef、credentialPresent、capabilities 和 enabled。写入 RouteInput 不带凭据引用；CredentialsInput 的认证只提交不返回，编辑留空保留已保存值。最多 32 路由且保留至少一条，128 规则。修改路由/认证/本机配置须停止监听并等在途请求结束。

TierField 为 missing/null/string/invalid/unavailable，原值、发送值和真实报回值分别返回。规则值为 1–64 个受限 ASCII token，语法合法不代表提供者接受。正文页最多 64 KiB UTF-8，标明脱敏、加密、截断和完整性；关闭正文、删除或权限失效撤销游标。读取正文需要 `gateway.records.read` 及已开启的录制状态，manage 不隐含读取。

一次网关 IPC 最多 256 KiB，列表 1–100；每 view 沿用 8 个在途请求限制，会话和订阅有全局/owner 上限。错误仅固定安全码与中文说明。认证、Cookie、管道原文、管理令牌、正文密钥、数据库路径不出现在状态、事件或错误 DTO。

## 5. CLI 接管边界

GatewayCliConfigService 使用宿主固定工具适配器、系统加密和原子写入；提供字段范围预览、冲突检查、备份与恢复。仅改变兼容工具的 base URL、客户端认证及必需的入口绑定。根配置/profile 的其他字段、模型及本地 `service_tier` 保持，tier 在请求网关层改写。

预览脱敏并有过期时间；应用核对原指纹，冲突保持原数据。恢复只处理本事务修改的字段，不能覆盖整份配置；用户后续改动冲突时保留双方内容。Codex 仅支持宿主可验证认证行为的显式 provider，未知格式拒绝。真实 CLI 版本尚未验收，本轮仅使用假认证和隔离 TOML/JSON fixture。

## 6. 实际主程序范围与兼容

主程序源码是当前运行实现，旧补丁交付已撤回；保留原有工作树修改，两个仓库分别验证与发布。

| 主程序范围 | 实际职责 |
| --- | --- |
| `shared/contracts/gateway.ts`、`gateway-validation.ts`、扩展契约/清单 | 方法、权限、严格 DTO、可选 minHostVersion |
| `electron/extensions/host.ts`、`electron/main.ts` | 权限、generation/view、服务组装、退出与撤销 |
| `electron/services/gateway-local.ts`、`gateway-runtime/*` | 应用自有实例、固定进程、私有配置、HTTP/SSE、TLS、owner 与生命周期 |
| `native/gateway-runtime/*`、`scripts/build-gateway-runtime.mjs` | Rust 核心、锁定 Cargo release 构建及完整依赖许可 |
| `gateway-management.ts`、`gateway-pairing.ts` | 固定管理协议、会话、指纹、DTO、事件与撤销 |
| `gateway-cli-config.ts`、`gateway-cli-process.ts` | CLI 事务、固定配置位置、加密备份、原生恢复入口 |
| `src/host/extension-frame.tsx`、市场权限标签 | 白名单、UTF-8 消息预算、视图退出、中文权限说明 |
| `public/lumi-extension-sdk.js`、`extensions/sdk/lumi-extension.d.ts` | 宿主 SDK 与类型，包含 local/setup/configure 及 routes/save/delete |
| 构建/发行脚本、文档与测试 | 内置资源打包、LICENSE、实际宿主和沙箱桌面回归 |

主扩展 API 保持 1，管理协议为 1。`minHostVersion` 已有严格可选校验，旧插件省略时保持原行为；网关插件最低公开版本待兼容宿主实际发布后填写。独立仓库 `host.json` 仍固定 `v0.5.20` / `0f8b4b5cbf084223a62795d73a11e20ab35e754d`，SDK pin 不能提前当作新接口已公开。公开 `0.5.23` 与本地开发 EXE 版本相同不代表能力相同。

## 7. 验证与发行状态

Windows 本轮 Rust 90 项、Node 42 项通过；实际主程序 846 项中 843 通过、3 项平台相关跳过，类型检查、插件检查、构建、隔离启动通过。使用安装包内核心的真实沙箱 Electron GUI 回归完成 96 次 SDK 调用、8 组流程、7 张截图，`.cache/gateway-plugin-ui/real-electron-IQWMSG/result.json` 包含端口占用后的无认证重录恢复、路由/认证/limits、实际转发、规则、正文、CLI 与生命周期证据。

本地完整 Windows 安装包校验匹配 78 文件，含 65 项 npm 与 84 项 Rust 依赖完整许可。未公开 Release，也未据此宣称签名、macOS、Linux CI、真实 CLI 或提供者验证。macOS ARM64 Keychain/原生包、真实协议版本兼容、证书轮换和安装升级须后续完成。先公开主程序并核验附件，再更新插件 pin/SDK/最低版本和发布目标插件；不另发用户必装伴随服务。

授权依据是 [工作区 AGENTS.md 第 4 节](../../AGENTS.md) 与 [插件 AGENTS.md](../AGENTS.md) 要求的明确主程序决定，本轮已取得。授权不包含真实凭据、付费调用、任意命令或放宽沙箱。本说明不授权提交、推送或发布。
