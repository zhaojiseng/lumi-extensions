# Lumi 模型网关插件完成计划书

- 日期：2026-10-11；实施计划 **v0.9**。
- 需求：记录 AI 请求与响应，并直接修改发往上游请求 JSON 的顶层 `service_tier`。“录制”不涉及麦克风或语音转写。
- 最新交付要求：**所有选项在 Lumi 界面配置，用户无需另外安装程序、执行终端初始化、编辑配置文件、生成证书或导入配对文件。**
- 插件 ID：`extension.lumi.gateway`；开发目录包版本 `0.1.0-dev.4`，包含六项 Web 运行资源。显示名称为“模型网关”，沿用原有实例与数据。
- 状态：Windows 本地界面与内置核心联动完成，安装包构建及校验通过；未提交、推送或公开发布。跨平台和真实工具/提供者兼容仍须验证。
- 真实证据及限制以 [网关验证记录](GATEWAY_VALIDATION.md) 为准。

## 1. 最终架构与用户流程

采用“独立插件界面＋Lumi 内置网关运行资源＋受限宿主接口”。插件仍是沙箱 Web 资源，负责中文设置、规则、记录与 CLI 操作。Lumi 主进程使用 Electron 自带的 Node HTTP/HTTPS 提供数据面和 TLS 管理服务，并启动安装包内固定 Rust 核心处理策略、响应观察和 SQLite 记录。用户不需要下载 Node、Rust 或伴随服务。

主程序的生产核心源码位于 [main/native/gateway-runtime](../../main/native/gateway-runtime)，Cargo 构建 release 二进制，随主程序安装包放入 `resources/native`。独立插件包不携带二进制、SDK、密钥或数据库；六项资源为 `plugin.json`、`index.html`、`app.js`、`style.css`、`README.md`、`LICENSE`。插件仓库中的 [运行时源码](../sources/gateway-runtime) 保留开发回归入口，不作为用户额外安装步骤。

用户在“首次设置”填写名称、数据端口、管理端口、首条路由、上游认证和客户端认证，保存后由宿主完成身份创建、系统保护存储和连接。高级设置调整最大请求大小与并发。后续可在页面新增、编辑、删除路由及更换认证；已有认证不回显，编辑留空保留原值。端口占用时可直接在页面修改端口并恢复，无需重新输入已保存认证。

数据监听由“启动监听”开启。规则、记录设置和兼容 CLI 的预览、接管、恢复均通过界面完成。修改端口、路由或认证前须停止监听并等待在途请求结束；至少保留一条路由，最多 32 条。管理连接断开不会自动停止数据监听；退出 Lumi 会关闭其管理服务、数据监听和核心进程，CLI 入口恢复仍需明确执行。

最新增量已获用户明确批准：读取已保存上游路由的模型目录。路由页“检测模型”无需启动数据监听，只发送固定模型目录 GET，展示检测时间、空目录/错误/不完整状态与可筛选完整 ID；点击模型可填入本地规则预览。未保存地址、协议或认证修改须先保存；切换、保存、断开和退出同步撤回旧结果。目录不证明真实推理可用性、额度、价格或 tier 支持，不改 CLI 模型。

本次页面改用宿主虚拟 `lumi-ui.css` 与默认标题、页签、面板、按钮、输入框、选择器、复选框、表格和弹层元素，插件样式只承担布局；既有皮肤及内置插件资源不改。客户端模型目录已获用户明确授权：监听后 `GET /<routeID>/v1/models`；完整配置仅一条保存路由时兼容裸 `GET /v1/models`。使用客户端密钥鉴权、保存的上游密钥读取目录，返回有界 OpenAI 列表及截断标记，保留正常排空与取消，不进入推理或录制。

2026-10-11 针对 Cherry Studio“API 密钥无效”定位到其同时发送 `Authorization` 与 `X-Api-Key`：相同有效密钥单 Bearer 返回 200，旧宿主双头返回 401。用户明确批准仅修改主程序客户端认证以接受相同有效双头，冲突值、错误值及重复头继续拒绝，并重新编译本地 EXE。界面改名、路由概览、折叠编辑、草稿保留、CLI 兼容筛选与记录刷新仍只在独立插件实现。

本次仅在独立插件优化“路由与规则”：两张全宽列表完整显示路由、四项规则条件、优先级、字段处理和状态；提供本地搜索、路由范围及启停筛选，规则数量和路由筛选仅检查路由条件并包含通用规则。列表顺序与实际匹配裁定分别说明，筛选保留原编号、选择、草稿及已有预览。模型目录、两类编辑和发送预览按需展开，窄窗口保留全部字段名和内容；接口编辑补齐 Anthropic Messages，避免保存旧规则时丢失接口条件。沿用前次 `gateway-cherry-20261011` 宿主，不增加权限、SDK 接口或主程序改动。

原有独立伴随程序安装、终端初始化、手工编辑 `config.json` 和配对文件流程已从用户交付路径撤回。现有 `network.read`、iframe 沙箱、preload 固定 IPC 与插件 API 版本 1 的限制保持；插件没有任意 shell、网络目的地址、文件路径或 SQL 能力。

## 2. 参考项目与协议证据

2026-10-10 已通过官方 GitHub HTTPS 获取并核验两个项目的固定源码和根许可证；未运行上游程序、其测试或真实 AI 请求。路径、永久链接和采纳表见 [参考研究](GATEWAY_REFERENCE_RESEARCH.md)。本实现没有复制上游实质源码。

| 来源 | 固定依据 | 采用的约束 |
| --- | --- | --- |
| [Magpie](https://github.com/yetone/magpie) | `d81706f974681d844cd378003d30baf6e10145b1`；MIT，2026 yetone | 参考有界录制和清空保护；不采纳上传归档、供应商隐式 tier 映射或拒绝后降档重发 |
| [CC Switch](https://github.com/farion1231/cc-switch) | `eda410e57b4659d6bbb2a10a069d8bac2213099a`；MIT，2025 Jason Young | 参考代理分层、SSE 用量和配置事务；其特定 FAST/OAuth 路径不替代本项目四模式或正文录制 |
| OpenAI 官方文档 | 实际获取 Responses/Chat 创建接口页面，见 [字段核对](GATEWAY_OFFICIAL_TIER_REFERENCE.md) | 区分请求、发送与实际响应 tier；语法合法不表示具体模型、项目或兼容站点接受 |

固定源码不是最新 Release 或安装包的保证。Lumi 自身测试必须证明字节保持、删除保护和无重试；不能用上游行为替代本地验收。完整第三方许可随实际主程序构建生成，参考项目根 MIT 不替代依赖许可。Lumi 既有归属见 [THIRD_PARTY_NOTICES.md](../../main/THIRD_PARTY_NOTICES.md)。

## 3. 已完成的 Windows 开发范围

| 能力 | 当前结果 | 验收边界 |
| --- | --- | --- |
| 本机设置与恢复 | 页面完成初始化、名称/端口/请求体/并发配置，端口占用后可恢复 | 端口 1024–65535，数据与管理端口不同；不误报启动成功 |
| 路由与认证 | 公共 HTTPS 路由新增、编辑、删除、启停、能力声明与双认证更换 | 1–32 条；新路由两项认证必填；旧值不回显；系统保护存储失败不降级明文 |
| HTTP/SSE | OpenAI Responses/Chat 与 Anthropic Messages 原协议流式转发 | 固定路由、真实 TLS、背压、取消、超时、并发与大小限制；不跟随重定向、不自动重试 |
| `service_tier` | 透传、删除、缺失时补入、强制覆盖，自定义发送值 | 核对模拟上游实际收到的字节；仅支持能力已声明的 OpenAI 路由 |
| 请求记录 | 默认元数据；明确启用后脱敏并加密正文，按需分页 | 原值/发送值/上游报回值分开；缺失用量和耗时保持未知 |
| 查询与数据管理 | 时间、路由、客户端、模型、接口、状态、tier 筛选，删除与元数据导出 | 有界扫描及游标；删除 tombstone 防止在途完成复活；无自由 SQL |
| CLI 事务 | 页面预览、冲突检查、加密备份、原子接管与恢复 | 仅固定工具入口和认证；模型及本地 `service_tier` 保持原值；仅隔离 fixture 验证 |
| 打包 | Rust 核心及完整依赖许可进入本地 Windows 安装包 | 插件仍独立目录包；公开最低宿主版本、固定 pin 和 Release 尚未更新 |

首版 HTTP 接口为 `POST /v1/responses`、`POST /v1/chat/completions`、`POST /v1/messages`。不支持 WebSocket/Upgrade、跨供应商协议转换、自动故障转移、请求重放、全局系统代理或 HTTPS 中间人解密。若真实 CLI 必需 WebSocket，应补齐传输支持或明确拒绝，不能用 HTTP fixture 宣称全面兼容。

## 4. 受限宿主接口与生命周期

用户已明确批准完整受限宿主桥接、固定 CLI 事务及本轮内置运行资源与全界面配置。具体协议见 [宿主桥接说明](GATEWAY_HOST_BRIDGE_PROPOSAL.md)。使用既有 `extensionRequest`，按插件权限、ID、generation、view、会话及实例校验；不新增任意 IPC。

| 权限 | 固定方法范围 |
| --- | --- |
| `gateway.control` | `status`、`pair`、`connect`、`disconnect`、`local.status`、`listener.start/stop`、`events.subscribe/unsubscribe` |
| `gateway.config` | `local.setup/configure`、`routes.config.get/set`、`routes.save/delete`、`routes.models.detect`、`rules.list/preview/replace`、`recording.config.get/set` |
| `gateway.records.read` | `records.list/get` |
| `gateway.records.manage` | `records.delete/export` |
| `gateway.cli-config` | `cliConfig.preview/apply/restore` |

名称均以 `gateway.` 为前缀。`pair` 保留为已有受限协议能力，本插件主流程采用宿主自动登记的本机实例，不要求用户配对文件。认证仅通过严格的写入输入提交，读取 DTO 只返回存在状态和引用；旧认证、管理令牌、私钥、录制密钥和本机数据路径不返回插件。

宿主为每个插件建立应用自有数据目录，固定调用包内二进制。私有初始化/配置消息最多 256 KiB，UTF-8、重复键和未知字段严格拒绝。`initialize-private` 创建新实例；`configure-private` 校验持久 `expectedVersion`，完整更新配置、路由和必要认证；安全输出仅 `{configVersion}`。记录密钥和未改认证保持，管理名称/端口变更保留证书、私钥及令牌。OS 保护备份与无秘密事务日志支持失败及中断恢复。

监听与管理端口分离，均为 loopback；管理端采用标准 TLS 与持久证书指纹，确认身份后才发送管理授权，校验 Host/Origin、实例和监听 owner。上游仅公共 HTTPS，启动和每次连接校验全部 DNS 地址，并固定当次连接地址及原域名 TLS 身份。

视图退出撤销当前会话/订阅和迟到详情，保持用户明确启动的数据监听。generation 变化、停用、包不兼容或摘要改变会撤销旧权限并停止所属托管运行资源；不得影响其他 owner。退出 Lumi 等待监听关闭与核心实际退出。主动停止拒绝新请求，限时排空或取消；取消不能证明上游没有执行，记录结果未知。

## 5. `service_tier` 行为约定

只修改请求 JSON 顶层自有属性；嵌套消息、工具参数和自然语言中的同名文本不变。

| 模式 | 字段缺失 | 已有字符串 | null / 非字符串 | 配置值 |
| --- | --- | --- | --- | --- |
| `preserve` | 保持 | 保持原值 | 保持原值 | 无 |
| `remove` | 保持缺失 | 删除 | 删除 | 无 |
| `set-if-missing` | 写入指定值 | 保持原值 | 保持原值 | 必须 |
| `override` | 写入指定值 | 替换 | 替换 | 必须 |

`null`、空字符串和非法类型不算缺失。删除与写入 `default` 不等价。自定义值格式为 `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`，例如 `provider_custom-2026`；不把 `fast`、`priority`、`ultrafast` 互相映射，接受与实际执行档位由上游决定。

按显式优先级、匹配范围具体程度、列表顺序选择唯一首条。范围包含 routeId、客户端别名、接口和请求原始模型。请求进入时冻结路由、规则、认证和录制策略；新配置只影响后续请求。预览只计算字段状态，不接收正文、不发送上游、不生成报回值。

`preserve` 保留 body 原字节；显式改写验证根对象、编码、重复键、大小及压缩兼容，只变更顶层 tier，保留其他数值词法和大整数。重新计算长度。上游拒绝时原样回传状态与响应，不删字段、降档、换供应商或自动重发。响应 tier 和正文不为匹配规则而修改。

记录分别保存 `original`（客户端原值）、`effective`（实际发送值）、`reported`（真实响应值），并保留 missing/null/string/invalid/unavailable。请求值不能代替实际 tier 或价格；缺失 token、缓存、首字/后续耗时不补零，速率与净速率不混用。

## 6. 录制与 CLI 事务边界

正文默认关闭；用户明确开启且系统安全存储可用时，已知敏感字段脱敏后采用 AES-256-GCM。Windows 使用 DPAPI，macOS Keychain 实现仍待 ARM64 当地验证；Linux 无明文回退。自然语言秘密不保证全部识别。数据只进专用本地记录库，不上传、不写入 Lumi 应用日志。

正文捕获为前 1 MiB/4096 段，完整响应继续转发。独立有界 SSE 观察可在长流末尾获得真实 usage/tier；单行 64 KiB、事件 256 KiB，观察超过 1 秒未响应则放弃并继续转发。正文截断与观察失败分别记录，不从捕获已满推断末尾字段。

正文读取每页最多 64 KiB UTF-8，单次游标且有有效期；关闭正文、删除、切换范围或权限失效立即撤回。筛选最多扫描 10000 条，超限显式拒绝。容量是元数据 UTF-8 与加密 payload 的逻辑上限，不等于 SQLite/WAL 物理大小；尚无全库聚合或全文搜索。导出仅脱敏元数据，不接收插件指定文件路径。

CLI 流程为预览、指纹冲突检查、加密备份、原子应用、恢复。只修改固定 base URL、客户端认证和必需入口绑定，保留根配置/profile 的模型和 `service_tier`。未知格式拒绝猜测；恢复只处理事务改动字段，外部修改冲突保留双方内容。“恢复入口并停止”先恢复成功再停止；恢复失败保持监听。仅停止提示 CLI 可能仍指向该入口。开发验证只用假认证、固定假上游和隔离 CLI 目录。

## 7. 当前验证与剩余发行门槛

本轮 Windows 验证：Rust 90 项、Node 68 项通过；主程序全量 848 项中 845 通过、3 项平台相关跳过、0 失败，类型检查、插件检查、构建和隔离启动通过。真实沙箱 Electron 流程使用安装包 `resources/native` 内核心，完成 98 次 SDK 调用、10 组流程和 9 张截图，结果为 `.cache/gateway-plugin-ui/real-electron-kgIAHD/result.json`。新增两次模型目录 GET 的已保存/轮换认证、无推理及无录制验证；覆盖空配置初始化、端口占用后的界面修复且不重新录入认证、配置大小/并发、路由增删与认证更换、四模式、自定义值及拒绝不重试、加密正文、CLI 恢复和生命周期。

完整 Windows 安装包校验匹配 78 项文件，含 65 项 npm 与 84 项 Rust 依赖的完整许可文本。这些是本地开发构建证据，不代表公开版本、签名认证、真实提供者或 macOS 验证。详细日志、摘要、SHA-256、截图与跳过原因见 [验证记录](GATEWAY_VALIDATION.md)。

| 剩余项 | 完成门槛 |
| --- | --- |
| macOS ARM64 / Linux CI | 实际 Keychain、原生构建、DMG、生命周期及对应平台检查；Windows 不能替代 |
| 真实 CLI / 提供者 | 固定版本、配置格式、HTTP/WebSocket需求、模型/项目权限及公共 HTTPS 实际兼容；需用户授权真实凭据或可能计费请求 |
| 证书轮换与更新 | 证书到期、身份轮换、安装升级及旧数据恢复；不覆盖已配对身份 |
| 长期性能 | 固定机器报告 1/8/32 并发、长流和持续运行的延迟、吞吐、CPU、内存与队列峰值；未测不称零开销 |
| 首次公开发行 | 已提交干净 HEAD、真实新宿主版本、签名/平台验收、公开附件及 SHA-256，之后更新插件最低宿主、pin 和 SDK |

内置运行资源、路由向导、认证更换、完整 Windows 包内许可与本地安装包校验已经完成，不再作为独立伴随服务的待办。WebSocket、重放、全库统计和全文检索仍是后续功能。

## 8. 开发命令与发布顺序

下列命令仅供开发者验证，不是用户设置步骤；真实执行结果以本次验证记录为准。

~~~powershell
# 独立插件仓库
Set-Location E:\workspace\lumi\extensions
npm.cmd run check:gateway
npm.cmd run check:gateway-host
node sources/extension.lumi.gateway/scripts/check-integration-ui.mjs ..\main
node sources/extension.lumi.gateway/scripts/check-chromium-ui.mjs
~~~

~~~powershell
# 主程序仓库：build 会构建内置 Rust 核心与完整依赖许可
Set-Location E:\workspace\lumi\main
npm.cmd run typecheck
npm.cmd run check:extensions
npm.cmd test
npm.cmd run build
npm.cmd run test:desktop
~~~

公开发行按两仓库各自规则进行：先发布实际包含新能力的主程序并核验公开附件；再更新插件 `host.json`、SDK 和真实最低宿主版本，复验既有插件；从干净已提交 HEAD 打包目标插件并核对原字节及 SHA-256，然后创建插件标签、草稿、附件并公开。插件当前 workflow-templates 不会因推送标签自动发布。

固定宿主目前仍为 `v0.5.20` / `0f8b4b5cbf084223a62795d73a11e20ab35e754d`。公开 Lumi `0.5.23` 不因与开发 EXE 版本号相同就具有本次接口；不填写虚构最低版本，不将本地成功当作公开发行。工作区只有两个仓库，不创建第三个仓库；本轮没有提交、标签、推送或 Release。
