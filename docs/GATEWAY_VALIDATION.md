# 模型网关验证记录

日期：2026-10-11。当前记录为模型网关 1.0.1 正式发布验证；公开状态见最上方发布记录。下方开发构建、安装和伴随程序结果保留为历史。

## 1.0.1 · 公开发布验收（2026-10-11）

- [模型网关 1.0.1](https://github.com/zhaojiseng/lumi-extensions/releases/tag/extension.lumi.gateway-v1.0.1) 已公开，发布时间 2026-10-11T04:28:21Z；标签固定 `89066089c8f4c69508c41ded02840871947f7300`。本次 ZIP 与 .sha256 两项附件完整，发布前下载草稿，逐项核对本地散列与 GitHub digest，公开后再次核对，同一草稿 ID 409405901。
- ZIP 为 59514 字节，SHA-256 `4134ddff31f2c5ceecda284ce0825f54a386b40a7969fe0fc2e915505c5ade85`；ZIP 的七项资源与正式提交、当前安装目录和 package-stage 原始字节一致，完整 MIT 许可在包内，没有宿主、开发源码、用户数据或凭据。证据 `.cache/release-101/{package-verification,draft-verification,public-verification}.json`。
- 最低宿主为 [Lumi 1.0.1](https://github.com/zhaojiseng/lumi/releases/tag/v1.0.1)，宿主先于本插件公开。host.json 固定该标签完整提交 `a0d48a2552c39e7002896385b50cc02263c1fa75` / API v1；官方校验器已验证全部五插件，实际 Windows 包内核心的沙箱 UI 验证见下节。主程序正式流程第 2 次执行三平台与两平台安装包全部通过，六项附件清单/digest 已核验。
- 1.0.0 标签因宿主检查失败未公开 Release，原标签保留；1.0.1 发布没有移动或覆盖既有公开标签/附件。其他插件资源与版本保持，已公开梦幻/Codex 包分别核对原标签。实际 CLI/提供者、macOS/Linux 的网关专项 UI 兼容仍受下节记录范围约束。

## 1.0.1 · 正式发行修订准备（2026-10-11）

- 插件清单与 README 为 1.0.1，最低 Lumi 1.0.1 / 扩展 API v1；七项安装资源与 package-stage 原始字节一致，插件 ID 和既有数据不变。两个仓库的 1.0.0 标签保留，宿主该标签 macOS 检查失败，未公开 Release；首次正式发行改用 1.0.1。
- host.json 固定 v1.0.1 的完整提交 `a0d48a2552c39e7002896385b50cc02263c1fa75`。从官方远程重新执行 setup:host 后，npm run check 验证全部五插件通过，网关 digest `11d907cf9a516c20c9f4f7081213a0e4489baa6e27d8cc4dd7e0621fbbd95976`，SDK 与固定宿主字节一致。日志 `.cache/release-101/{setup-host,check}.log`。
- 最终 Windows 1.0.1 包内核心的真实沙箱 Electron `real-electron-sR7JeE/result.json` 通过：25 组、227 次 SDK 调用、27 个事件、24 项视图、26 项概况/弹窗及 67 张截图；错误与意外网络为空。实际 Host/Frame/preload/SDK、TLS、系统加密和包内 Rust 核心参与；已目视并发概况与梦幻深色 480 px 供应商编辑。核心 SHA-256 `e930b928a9486f97fed5a96c7e8f36a6f78edc9e33db998a54593f37214d94b9`。
- 主程序本次 901 项：898 通过、3 平台跳过，dist、隔离桌面启动、78 文件包核验与 0 漏洞审计通过，见主程序 1.0.1 验证记录。本修订未改两份 Rust/Node 运行时源码，1.0.0 准备阶段的 108/105/91 项检查在下节保留，不宣称本次重跑。
- 首次以沙箱账户启动被 Windows AppContainer ACL 阻止，未关闭 Electron 沙箱或改 ACL；改用当前 Windows 用户执行相同隔离夹具后成功。日志 `.cache/release-101/integration-ui{,-final}.log`。没有使用用户实际 CLI、真实密钥、会话或付费上游。
- 默认宿主固定与真实 UI 通过后，从已提交干净 HEAD 打包并核对 ZIP 原始字节；待主程序公开 v1.0.1 后再公开本插件 ZIP 与校验文件。其他插件安装资源相对本轮发布前提交未改变，版本保留；已公开的梦幻 1.1.8 和 Codex 对话 2.2.11 额外核对其发布标签字节一致。macOS/Linux 网关 UI 与真实提供者兼容范围不由 Windows 检查替代。

## 1.0.0 · 正式发布准备（2026-10-11）

- 插件清单与 README 为 1.0.0，最低 Lumi 1.0.0 / 扩展 API v1。七项安装资源与 package-stage 原始字节一致；插件 ID、已有路由/认证/记录和其他插件版本保持。
- host.json 固定 v1.0.0 的完整发布提交 `5f9c76d25e73f33575ca9d94524b66f2e38abf61`；从官方远程重新执行 setup:host 后，npm run check 校验全部五项插件通过，网关 digest `ad51816b9c076f4ee6c4c14c12e721b5d62e845546dafafa2effbcf76978e7ed`。便携 SDK 与宿主 SDK 的 SHA-256 相同。日志 `.cache/release-100/{setup-host,check}.log`。
- 本次独立 Rust 105 项、严格 clippy、Node 91 项运行时回归全部通过；假凭据/拒绝地址夹具改用等值表达式，扫描规则未放宽，完整暂存凭据扫描及差异空白检查通过。运行时日志 `.cache/release-100/gateway-runtime-final.log`；宿主全量 901 项（898 通过、3 平台跳过）及内置 Rust 108 项见主程序本次验证记录。
- 最终 1.0.0 安装包内核心的真实沙箱 Electron 回归 `real-electron-TYhHoY` 通过：25 组流程、227 次 SDK 调用、28 个事件、24 项视图检查、67 张截图，错误和意外网络为空。覆盖统一接入与认证轮换、草稿目录、热配置/端口事务、两段规则、真实上游 404、浅深/默认/梦幻及 1280/600/480 px；已目视并发概况与深色短窗口供应商编辑。
- 默认界面回归入口改用匹配宿主 dist-native 中的固定核心，重新执行并通过 `real-electron-MTDCjP`；显式 --binary 可选择安装包内核心。两份报告均保存于 `.cache/gateway-plugin-ui/<对应目录>/result.json`，不是 mock SDK 或关闭沙箱的检查。最近 5 秒窗口、并发线路及未知字符速率保持真实观测，token 用量不由字符数补造。
- CLI/应用数据、凭据、模型与上游均为隔离夹具；没有操作用户实际 CLI、会话或付费请求。Windows 结果不替代 macOS/Linux 的网关 UI 与真实提供者兼容验证。主程序须先完成公开 v1.0.0 发布，再公开本插件 ZIP 和 .sha256。

## 历史交付：供应商模型、两段整流与三协议链路（2026-10-11）

模型网关为 `0.1.0-dev.5`，主程序仍为未发布开发构建 0.5.23。已获得用户对固定宿主契约、配置校验、托管运行时及记录/链路接口的联动授权；本节为本轮新实现和实际验收结果，下方旧构建记录仅作为历史。

供应商共享一套 API 地址、认证和上游协议，在其下配置多个对外模型名称与实际模型 ID；Agent 通过已保存的客户端认证引用配置供应商访问范围。界面显示 Agent → Lumi → 供应商 → 模型，两处连线进入相应整流规则。入口整流与模型整流支持保留、删除、缺失补入、覆盖、枚举映射、范围限制及拒绝，并冻结每次请求配置。预览不请求上游，正文按原始字节显示；实际测试包含超出 JavaScript 安全整数范围的数字，预览与真实发送完全一致。

三种入口与上游分别配置：Responses、Chat Completions、Anthropic Messages，统一认证入口含 `/v1/models`。三种同协议透传保持未修改字节；跨协议覆盖文本、多轮、自定义函数工具往返与受支持图片，JSON/SSE 分别转换。不支持的会话状态、内置工具、隐藏思考/签名等明确拒绝，不静默丢弃。旧 Anthropic 的 OpenAI tier 开关限制保持，原生档位由显式整流处理。缺失字段的 clamp 保持缺失，父子字段同时命中明确报冲突；工具 strict 默认值、流式终态和不安全数字转换有专门回归。

| 本轮检查 | 实际结果与证据 |
| --- | --- |
| 运行时 | Rust 104/104、Node 91/91，严格 clippy 和运行时/fixture 构建通过。`.cache/gateway-v2-runtime.log`、`.cache/gateway-validation/result.json` |
| 主程序全量 | 866 项，863 通过、3 平台跳过、0 失败/取消。`main/.test-data/gateway-v2-main-test-confirmed.log`；实际 Rust/DPAPI 管理链路覆盖九种协议组合的 18 次 JSON/SSE 工具往返和发送前拒绝 |
| 类型与包 | main 严格 typecheck、check:extensions 通过；使用本次 main 官方校验器验证独立仓库五项插件、冻结包及已安装包通过，网关为 7 项文件/199,949 字节，digest `10a5be35d7bf3e4824f6d5e30a35ed4f8df8703475f901c10255dcc20c4e2fd4` |
| 真实沙箱 Electron | `real-electron-AePmvC/result.json`：20 组流程、284 次 SDK 调用、17 个事件、36 项六页浅深/1280、600、480 px 布局检查、39 张截图；错误和意外网络请求为空。实际 Host/Frame/preload/SDK/TLS/系统加密/包内 Rust 核心，sandbox/contextIsolation 开启、Node 关闭 |
| 新界面行为 | 两模型映射、三入口持久化、Agent 范围/未保存草稿、入口 clamp/模型 tier 覆盖、预览无请求与输入变化撤回、预览字节等于发送、Chat→Responses、供应商范围发送前拒绝、五事件链路、规则连线筛选和确认删除通过；原有正文/CLI/目录/记录/撤销流程保持 |
| EXE 与许可 | Windows x64 NSIS EXE `main/release/gateway-v2-20261011/Lumi-0.5.23-x64.exe`，113,242,877 字节；SHA-256 `d4d1f5a0ecbd7fc08bc992cf6d108820ed4d1620d08a540320baba0f3f40689c`。verify:release 匹配 78 个构建文件，65 npm/84 Rust 完整许可、核心字节、两份既有插件及无本地数据通过；核心 SHA-256 `3285097898e4f98ce73b41c0b4f0d64cef86a818eee66dc954456c59c0fa3b30` |
| 桌面启动 | 官方 smoke 派生脚本仅调整截图位置与包内启动路径；checkout 与 `win-unpacked/Lumi.exe` 均通过，使用隔离应用与 CLI 家目录。`main/.test-data/gateway-v2-{checkout,packaged}-smoke.log` |
| 用户指定目录安装 | 2026-10-11 03:17:25 +08:00，安装到 `<Lumi 额外插件目录>/extension.lumi.gateway`；7 项安装字节与冻结包一致，官方校验通过。原 dev.4 六项文件已备份并逐项核对。报告 `release/gateway-v2-20261011/install-report.json` |

冻结目录为 `release/gateway-v2-20261011/extension.lumi.gateway`，逐文件原始字节校验为同级 `plugin-files-sha256.json`。原安装包备份在 `installed-backup-20261011-031725-234/extension.lumi.gateway`；同级 `validation-summary.json` 汇总确切检查、附件散列和限制。新包没有覆盖旧开发安装包或公开附件，插件没有编译进 EXE；自动安装仅更新指定插件目录，不改变应用设置、其他插件或用户 CLI 配置，也未执行主程序安装器。

收尾同步了 portable SDK 和开发指南完整类型声明。早期 `.test-data/gateway-v2-main-test.log` 含旧契约/文档失败，不作为最终通过证据；第一次收尾全量中的原有字号 UI 用例退出失败，原断言未改，单独复核 `gateway-v2-typography-recheck.log` 和完整复验均通过。最终检查不使用历史测试记录替代本轮执行。

公开固定宿主 `host.json` 未改。默认 `npm run check` 使用该旧公开宿主，不能识别网关权限而失败；本轮改用上述当前配套 main 的官方校验器，没有放宽解析规则。公开 0.5.23 没有本次开发接口，插件必须配套本次 EXE。未提交、推送、创建标签或公开发布。

转换为 Messages SSE 时，等待上游消息与真实必需用量完整后编码，因此首段返回延后；缺失用量保持未知或明确拒绝，不补造数值。自动故障转移、Gemini、token 计数及 Responses 状态接口仍为后续阶段。Windows 检查不替代 macOS/Linux、真实 CLI/供应商、主程序安装/升级验收。全部推理验证只使用假凭据和本机隔离 HTTP/TLS 上游。

## 历史交付：路由与规则显示效率（2026-10-11）

独立插件更新至 `0.1.0-dev.4`。两张连续的六列表分别展示路由、协议、完整上游地址、状态和认证、按路由范围统计的规则数量，以及规则原始列表位置、优先级、完整四项匹配条件、动作和自定义值、启停状态。搜索与路由范围/启停筛选在本地完成，通用路由范围规则保留，其他客户端/模型/接口条件仍须请求满足；筛选不改保存数组或重新编号。选中项被筛选隐藏时保留编辑内容并显示提示。

模型目录、路由/规则编辑和发送预览全部默认折叠并位于两列表之后。普通选择不展开或滚动，显式编辑、新增及未保存草稿的阻断会展开并定位到相应编辑器；点击模型 ID 展开并定位到本地预览。规则接口选项补齐宿主既已支持的 `/v1/messages`，保存旧规则不会丢失该条件。实际宽屏检查发现默认 `td` 的 `nowrap` 导致 Anthropic 协议横溢，插件表格布局改为允许换行，未改变宿主字体、颜色或控件尺寸。

| 本轮检查 | 实际结果 |
| --- | --- |
| 静态结构与语法 | `app.js` 语法检查、两仓库 `git diff --check` 通过；187 个 ID 唯一、8 个 form 正确闭合且无嵌套，两表各 6 个 `scope=col` 标题，四个 details 各有直接 summary。证据 `.cache/gateway-dense-ui/static-html.log` |
| Chromium | `chromium-SXTntd/result.json`：16 组流程、218 次 SDK 调用、24 项四页布局检查、24 张截图。原流程认证提交严格 3 次，新密集场景再提交 3 次，每条新增路由一次，总数精确 6；共享配置版本与 CLI 恢复/停止顺序仍逐次核验 |
| 真实沙箱 Electron | `real-electron-Z5IA5K/result.json`：15 组流程、166 次调用、13 个事件、60 项宿主默认元素严格对照、24 项四页布局检查、27 张截图。使用当前源码的实际 ExtensionHost/Frame、preload、SDK、TLS、系统安全存储和前次 EXE 的 Rust 核心；sandbox/contextIsolation 开启、Node 关闭 |
| 轻量 Electron | `run-QxxsgX/result.json`：16 组流程、218 次调用、浅深两张截图。固定 `must-not-load.invalid/probe` 的预期 CSP 拒绝单独识别，其他 console/宿主错误和意外网络请求保持失败检查 |
| 显示与交互 | 四条路由、六条规则的完整字段、安全文本、组合搜索/路由范围/启停筛选无新增 RPC；隐藏选中项、未保存草稿、原始序号及过滤后的移位、Messages 编辑保存条件保持；closed details 的实际内容不可见，显式编辑的 summary 在辅助滚动前已经进入视口 |
| 旧功能与生命周期 | 模型目录、四种 tier 处理、自定义值及上游拒绝不重试、实际正文录制、隔离 CLI 恢复、记录首批翻页通知、view/generation/停用撤销继续通过。最终三份结果的 `errors`、`blocked` 均为空 |

结果目录均在 `.cache/gateway-plugin-ui`，最终运行日志为 `.cache/gateway-dense-ui/{chromium,real-electron,lightweight}-final.log`。浅深主题与 1280/600/480 px 原有矩阵保留。最终目视宽屏浅色、480 px 深色路由/规则截图：标题和导航完整，两表连续，完整规则首行进入宽屏视口；窄屏保留字段标签、内容与独立纵向滚动，无横向溢出。窄屏一行可能高于列表视口，需要内部滚动，不表示六字段同时可见。宽屏规则表起点由首次通过布局的 910.60 px 移到 777.27 px，宿主窗口为 1280×1000，iframe 宽 1229 px，根滚动为 0；初次版本 `real-electron-q2MaCn` 等保留为本轮中间结果，不用作最终包证据。

交付目录为 `release/gateway-dense-ui-20261011/extension.lumi.gateway`，只有六项运行资源及完整 MIT 许可，共 159,811 字节；同级 `plugin-files-sha256.json` 记录各文件长度与 SHA-256，复制时逐项核对源码原始字节。主程序官方包校验器通过，digest 为 `1a0e5deacba4e93e889b7d5c65fbe905c45df490e5d5d451b6aa374bf66581a6`；既有插件的 `npm run check` 通过。新目录没有覆盖前次开发包，不使用含未提交源码的正式 HEAD 打包流程。

本次只修改独立插件及其验证/说明，不改主程序、不重建 EXE。509 项主程序文件与本轮初始 SHA-256、90 项既有插件文件与原始 SHA-256 全部一致，无新增主程序文件，记录为 `.cache/gateway-dense-ui/source-preservation-final.json`。沿用 `main/release/gateway-cherry-20261011/Lumi-0.5.23-x64.exe`，内置核心 SHA-256 仍为 `c39aa98f950888a6b700bf6b918946ead90543c58188fd4e439a77b7c52fcb93`。只使用隔离假凭据、固定本机 HTTPS 假上游和 CLI fixture，没有读取真实 CLI/Cherry 配置或发起收费调用。记录摘要事件仍由隔离 fixture 经生产 preload/SDK 注入，不证明 Rust 核心自动投递该事件。主程序全量及运行时测试未在本轮重跑，下方对应结果仅属于前次构建。未提交、推送、公开发布或安装到用户数据目录；跨平台、真实提供者和实际安装升级仍待验证。

## 当前交付：模型网关布局、操作逻辑与 Cherry 兼容（2026-10-11）

独立插件 `0.1.0-dev.3` 的显示名称统一为“模型网关”，保留 ID `extension.lumi.gateway`、原视图 ID、权限和既有数据。运行概览先显示监听状态与操作；模型页默认选已保存路由，先展示 Base URL、完整模型 GET 地址和模型目录，认证编辑折叠；接入页先放 CLI，记录页明确选择数量与新记录提示。四页复用宿主默认元素，浅深主题与窄窗口布局保持。

编辑器分别保留非秘密草稿，切换条目时要求保存或取消；清空认证后提示重新填写，保存其他配置不覆盖草稿。规则预览绑定输入、会话与配置版本；CLI 只列兼容且已启用的路由，普通恢复不意外停止监听。记录通知在选择、详情、分页及翻页在途时延后刷新，失败不清空选择。真实桌面发现并修复未拥有监听时的首次启动阻断、重连规则值输入隐藏及首批翻页通知竞态。

Cherry Studio 2.1.4 固定同时发送 `Authorization: Bearer <key>` 与 `X-Api-Key: <key>`。用户给出的密钥仅在内存对本机模型目录做只读 A/B 检查：单 Bearer 返回 200/6 个模型，双头返回 401；Cherry 的“API 密钥无效”是 401 通用文案。用户明确批准修改主程序客户端认证及重新编译 EXE。`authenticated` 现在仅允许两种头各出现一次且均严格匹配同一保存密钥，冲突、错误、空值、畸形 Bearer 与重复头仍拒绝。单头协议行为、Host/Origin、TLS/DNS、并发和上游凭据隔离保持。

| 本轮检查 | 实际结果 |
| --- | --- |
| Chromium | `.cache/gateway-plugin-ui/chromium-HMOo6y/result.json`：13 组、173 次 SDK 调用、24 项布局检查、24 张图；浅深主题与 1280/600/480 px 全过，错误/意外网络请求为空 |
| 本次包内核心与实际 UI | `.cache/gateway-plugin-ui/real-electron-chuBES/result.json`：当前源码宿主与本次安装包固定核心，12 组、120 次调用、13 个事件、60 项默认控件严格对照、24 项四页布局与 27 张图通过；进程沙箱、真实 Host/Frame/preload/SDK/TLS/系统加密及撤销通过 |
| 新操作边界 | 两次真实网关配置保存/重连后，override/set-if-missing 草稿值仍可见可编辑；51 条固定本机 TLS 假上游请求生成 50 条首批及 1 条下一页，翻页在途跨越 150 ms 通知窗，未被首批读取抢占 |
| 运行时 Node | 全量 91/91 通过，0 跳过，`.cache/model-gateway-ui/runtime-node-final.log`；认证定向三文件 54/54 通过。GET 模型与 POST 两协议、准确正文、有效双头、冲突/畸形/重复、仅上游认证转发均有回归 |
| 主程序 | build 中严格 typecheck、check:extensions 与构建通过；全量 npm test 848 项：845 通过、3 平台跳过、0 失败，`main/.test-data/gateway-cherry-main-test.log` |
| Cherry 实际运行时 | `main/.test-data/cherry-endpoint-review-v6zkr7/gateway-auth-package-evidence.json`：隔离复制 Cherry Electron 44.2.0，使用安装资源的原始 defaultHeaders/mergeHeaders 和模型 schema，针对新包 main.cjs 原样提取的网关区域；有效双头 200/6 项有效/0 丢弃，冲突及同值错误双头 401，目录 1 次、引擎/录制 0 次 |
| 完整 Windows 安装包 | dist、verify:release 通过：78 个构建文件匹配、65 npm/84 Rust 完整许可、现有内置插件与无本地数据；源码与包内 win-unpacked/Lumi.exe 的隔离官方 smoke 均通过 |

EXE：`main/release/gateway-cherry-20261011/Lumi-0.5.23-x64.exe`，113,095,492 字节，SHA-256 `20e6bdd4288bfa48227c593f0e559126f2c653a9936935044942cebe94faca24`。Rust 源码未改或重跑测试，本次包内核心仍为 `c39aa98f950888a6b700bf6b918946ead90543c58188fd4e439a77b7c52fcb93`。主程序日志为 `.test-data/gateway-cherry-{main-test,exe-dist,exe-verify,checkout-smoke,packaged-smoke}.log`；最终实际 UI 日志为 `.cache/model-gateway-ui/real-electron-packaged-final.log`。插件单独位于 `release/model-gateway-ui-20261011/extension.lumi.gateway`，六项资源与同级 SHA-256 清单匹配，官方包校验通过，digest `3c60369b0afe80df5f4a31a775488c557f07c95dc22d08605f42c7263eb35766`；没有覆盖旧构建。主程序本轮开始时 509 项源码中只改变已授权认证文件与本次验证记录，未增加新源码；两仓库 90 项既有插件文件全部保持原字节，证据为 `.cache/model-gateway-ui/source-preservation-final.json`。

已目视检查最终宽屏浅色路由和 480 px 深色接入页，标题完整、分栏及折叠清晰、无横向溢出。分页的 `record-summary` 是固定夹具经实际生产 preload/SDK 和当前 subscription/session 投递，不能写成核心自动摘要事件。Cherry 测试没有加载实际应用入口或读取用户配置；提取仅增加独立导出，包内原始区域与 app.asar 前后 SHA 均有证据，原安装包未改。实际用户密钥只用于前述三次本机目录 GET，不输出、落盘或用于推理；后续回归全部使用假凭据。未操作用户真实 CLI 数据或安装器，主程序版本仍为 0.5.23，未提交、推送或公开发布；其他平台、真实提供者推理及安装升级仍待验证。

## 当前交付：默认元素与客户端模型目录（2026-10-10）

网关开发插件更新至 `0.1.0-dev.2`，使用宿主虚拟 `lumi-ui.css` 的默认标题、页签、面板、按钮、输入框、选择器、复选框、表格、通知及弹层。插件 CSS 只保留内容布局，SDK 与宿主 CSS 不打入目录包；客户端 API 地址由已保存路由和数据端口计算。两仓库 90 项既有内置/独立插件文件 SHA-256 保持本轮开始时原值，包含所有皮肤资源。

用户明确授权主程序新增客户端 `GET /<routeID>/v1/models`，完整保存配置仅一条路由时兼容 `GET /v1/models`；多条配置即使其余禁用也拒绝猜测。沿用路由客户端认证，保存的上游认证只发给固定上游。复用目录公共 DNS/TLS/分页和限额，返回 `{object:'list',data:[{id,object:'model'}],lumi_truncated}`，不补造创建时间、所有者或价格。最多 500 项/128 KiB，并提供 `x-lumi-models-truncated`；目录占共享请求限额，支持正常 drain、取消和配置版本撤销，不调用核心 prepare/observe/finish 或生成 AI 记录。

| 本轮检查 | 实际结果 |
| --- | --- |
| 运行时 Node | `node --test sources/gateway-runtime/tests/*.test.mjs`：86/86 通过，0 跳过；新增客户端目录 12 项及真实 TLS 数据 GET 6 项，日志 `.cache/gateway-default-ui/runtime-node.log`。涵盖原 GET 推理路径 405、认证、Host/Origin、单/多路由、实际 TLS 上游认证、共享并发、停止/取消、迟到配置、截断、私密反射及无推理/录制 |
| 主程序 | typecheck、check:extensions 与完整 build 通过；npm test 848 项，845 通过、3 平台跳过、0 失败，日志 `main/.test-data/gateway-default-ui-models-main-test.log`。三项仍为 Unix shebang、Swift/AppKit 和 macOS 原生玻璃；Rust 本轮未修改或重跑，前次 90 项记录保留为历史 |
| Chromium | `.cache/gateway-plugin-ui/chromium-SYTK5A/result.json`：7 组流程、128 次调用、11 张截图，600 px 四页无横向溢出，迟到目录/详情和认证撤回通过，错误及意外网络请求为空 |
| 新包核心与真实 UI | `.cache/gateway-plugin-ui/real-electron-Tszb5i/result.json`：当前源码宿主与本次安装包核心，10 组流程、103 次 SDK 调用、9 个事件、27 张截图；1280/600/480 px、浅深主题的 60 项默认控件严格对照与 24 项四页布局检查全过，客户端地址使用数据端口 |
| 生命周期与旧功能 | 实际 ExtensionHost/Frame/preload/SDK/TLS/Rust/系统加密；sandbox/contextIsolation 开启、Node 关闭，正文/CLI 恢复、四种 tier、自定义拒绝不重试、端口修复、双认证轮换、view 释放、generation/停用撤销均通过；两次管理目录 GET 使用原有/轮换认证且零推理/录制，错误/阻断为空 |
| 完整 Windows EXE | `dist`、`verify:release` 通过：78 个构建文件原始字节匹配、65 npm/84 Rust 完整许可、两份现有插件、核心原始字节与无本地数据；checkout 及包内 `win-unpacked/Lumi.exe` 的隔离官方 smoke 通过 |
| 独立插件包 | 六项资源逐字节匹配源码与同级 `plugin-files-sha256.json`，当前主程序官方包校验器通过，digest `66b4ac6b9a2b97fe41c55f887e09be11ed7134bfa5f73589d6636d4c66f9990b` |

EXE：`main/release/gateway-default-ui-models-20261010/Lumi-0.5.23-x64.exe`，113,095,311 字节，SHA-256 `fc0afb606a1cd7574408299bf0463dbac77b194782caca90afb756dfcd853c31`。网关 Rust 核心仍为 `c39aa98f950888a6b700bf6b918946ead90543c58188fd4e439a77b7c52fcb93`。插件位于 `release/gateway-default-ui-models-20261010/extension.lumi.gateway`；安装器与插件输出均新建专用目录，没有覆盖既有开发包。主程序日志前缀为 `gateway-default-ui-models`，包括 `exe-dist/verify` 和 `checkout/packaged-smoke`。

已目视确认宽屏浅色路由和 480 px 深色录制页面。隐藏窗口截图前唤醒 compositor、清理控件焦点并重置宿主根文档/iframe 祖先滚动，27 张图的标题完整可见；几何证据为同目录 `screenshot-geometry.json`。这些修订仅在测试 harness，产品无需滚动补丁。

目录 API 的实际 HTTP/TLS 由独立 Node 回归覆盖，真实 Electron 覆盖默认控件、SDK 与管理目录；完整安装包另做正式资源/启动校验，没有在用户数据目录运行安装器。只使用隔离本机假上游和 CLI 文件，未使用真实认证或付费请求。主程序版本保持 0.5.23，未提交、推送或公开发布；公开 0.5.23 不具有本轮开发接口。Windows 结果不替代其他平台、真实提供者/工具和安装升级验证。

## 当前交付：上游模型目录检测（2026-10-10）

用户已明确批准新增受限宿主接口并重新编译 EXE。路由页现在提供“检测模型”、刷新、检测时间和本地筛选，点击完整模型 ID 可填入本地规则预览。使用已保存路由及已有认证；新路由或地址/协议/认证等未保存修改须先保存。目录查询不要求启动数据监听，不执行推理，也不生成 AI 录制记录；目录不证明实际调用权限、额度、价格或 service_tier 支持。

固定 `gateway.routes.models.detect` 归属已有 `gateway.config` 权限，输入只有 `sessionId/routeId/expectedVersion`，返回有限目录 DTO，不接收 URL、请求头、密钥或文件路径。OpenAI GET `/v1/models` 使用 Bearer；Anthropic 使用 `x-api-key` 与 `anthropic-version:2023-06-01`，最多五页。每页检查全部公共 DNS 地址并固定连接，保持 TLS 校验、拒绝重定向；最多 500 个模型 ID、每 ID 256 UTF-8 字节、总响应 1 MiB、总时限 12 秒。检测最多两项并发，网络等待不占管理串行队列；配置、身份、页面或运行资源撤销后拒绝旧结果。只传固定错误码，凭据反射与远端错误正文不返回。

| 本轮检查 | 实际结果 |
| --- | --- |
| 核心与 Node | `npm run check:gateway`：90 Rust + 68 Node 全过，严格 clippy 与构建通过；新增目录 17 项、真实 TLS 管理目录 9 项，日志 `.cache/gateway-models-runtime.log` |
| 主程序 | typecheck、check:extensions 与构建通过；完整 npm test 848 项，845 通过、3 项平台跳过、0 失败，日志 `main/.test-data/gateway-models-main-test.log`；最终 UTF-8/孤立代理字符契约回归再次通过 |
| Chromium 界面 | `.cache/gateway-plugin-ui/chromium-Q6FhGG/result.json`：128 次调用、7 组流程、11 张截图，空目录、认证/接口错误、截断、未保存修改、刷新及迟到成功/失败撤回通过，600 px 四页无横向溢出 |
| 真实桌面与包内核心 | `.cache/gateway-plugin-ui/real-electron-kgIAHD/result.json`：98 次调用、10 组流程、9 张截图；使用本次安装包内固定 Rust 核心，两次真实 TLS GET 验证原有与更换后的上游认证，检测期间零推理 POST、零录制记录 |
| 隔离与旧行为 | 真正 ExtensionHost/Frame、固定 preload/SDK、系统加密与 TLS；沙箱/contextIsolation 开启、Node 关闭、直接网络拒绝，预算与停用/代次撤销通过；原四种 tier、加密正文、CLI 恢复与端口修复仍通过 |
| 安装包 | Windows x64 NSIS EXE 113,093,062 字节；verify:release 匹配 78 个构建文件、65 npm/84 Rust 完整依赖许可、核心原始字节与无本地数据，通过；包内 win-unpacked/Lumi.exe 隔离官方 smoke 通过 |

本轮 EXE：`main/release/gateway-models-20261010/Lumi-0.5.23-x64.exe`，SHA-256 `0e11152f3bc3279f3fd634f376936ffe5e021446b5fa07e9d23a681c1079547a`。包内核心 SHA-256 仍为 `c39aa98f950888a6b700bf6b918946ead90543c58188fd4e439a77b7c52fcb93`，Rust 本轮未改。主程序日志为 `gateway-models-exe-{dist,verify}.log` 和 `gateway-models-packaged-smoke.log`；插件模型目录包交付到 `release/gateway-models-20261010/extension.lumi.gateway`，六项资源逐字节匹配源码及同级 SHA-256 清单，当前主程序官方校验器通过，包 digest `0014a9bba899d8708e7c9041b82dd0d5a14f36c4ee33013ef7846bddcf17963f`。

当前源码宿主结合安装包内核心参与真实 GUI 集成，完整安装包另做启动与资源校验；没有在用户实际数据目录执行安装器。测试仅使用固定本机 TLS 假上游（CA 验证开启、构造器限定 DNS/dial）与隔离 CLI 文件，未读取真实凭据或发送付费请求。已目视检查模型卡和恶意 ID 的纯文本显示。版本不变，未提交、推送或公开发布；Windows 结果不替代 macOS/Linux 及真实提供者/工具兼容。新输出位于专用目录，既有两个开发包和默认历史目录未改。

截图复验：隐藏窗口首次 capture 可能返回上一个合成帧，测试先捕获并丢弃唤醒帧，再记录当前画面；未改产品逻辑。最终 `.cache/gateway-plugin-ui/real-electron-I5m7aN/result.json` 仍为 98 次调用、10 组、9 图通过，主路由模型卡截图已目视确认。

## 当前交付：内置运行资源与全界面配置（2026-10-10）

用户要求所有选项直接在界面配置，不再外接运行工具。本次开发 EXE 内置固定 Rust 核心和管理模块，由 Lumi 自动准备、加密保存及启停。首次设置、数据/管理端口、请求大小和并发上限、路由增删、认证更换、规则、录制与 CLI 预览/应用/恢复均在插件页面完成；用户不需要终端、独立服务、证书生成或配对文件。数据固定在应用专用目录，页面不接收任意路径或可执行文件；凭据仅经受限接口和私有管道写入系统保护存储。

| 当前检查 | 实际结果与证据 |
| --- | --- |
| 运行时回归 | 90 Rust + 42 Node 全过，fmt、严格 clippy、核心/fixture 构建通过；`.cache/gateway-validation/result.json`，UTC 13:45:08–13:45:16 |
| 新增配置事务 | 8 项 Rust provisioning 回归，涵盖严格私有输入、凭据/版本/重启、提交前后恢复、只读失败；原有 82 项仍通过 |
| 托管服务 | 14 项回归通过，包括真实 Windows DPAPI/TLS/Rust 集成、端口占用后的离线修复、固定进程和实际退出等待；契约与管理 36 项通过 |
| 主程序全量 | 846 项，843 通过、3 项平台跳过、0 失败；`main/.test-data/gateway-gui-main-test.log`。typecheck、check:extensions、构建、隔离桌面启动通过 |
| 实际 GUI 与包内核心 | `.cache/gateway-plugin-ui/real-electron-IQWMSG/result.json`：96 次 SDK 调用、8 组流程、7 张截图；使用安装包 `resources/native/lumi-gateway-runtime.exe`，SHA-256 `c39aa98f950888a6b700bf6b918946ead90543c58188fd4e439a77b7c52fcb93` |
| GUI 覆盖 | 空目录首次设置、端口占用后无需重输认证即可修复、2.5 MiB/16 并发保存、路由增删、双认证更换后的实际转发、四种 tier 与自定义成功/原错误不重试、加密正文和 CLI 恢复后停止 |
| 隔离与生命周期 | 真实宿主/Frame/preload/SDK/TLS/Rust/系统安全存储；进程沙箱与 contextIsolation 开启、Node 关闭、opaque iframe、直接网络拒绝；视图释放、generation 与停用撤销、UTF-8/旧方法预算通过；错误和意外网络请求为空 |
| Chromium 页面 | `.cache/gateway-plugin-ui/chromium-SWl1F4/result.json`：100 次 SDK 调用、11 次配置写入至版本 12、3 次认证提交、11 张截图；600 px 四页无横向溢出。最后的重连操作锁由上述实际 Electron 再次覆盖 |
| 包与许可 | Windows x64 NSIS 开发安装包 113,090,539 字节；verify:release 匹配 78 个构建文件、包内核心原始字节、65 份 npm 与 84 份 Rust 完整依赖许可、两份既有插件及无本地数据，通过 |
| 正式启动 | 包内 `win-unpacked/Lumi.exe` 与当前 checkout 的隔离官方 smoke 均通过；`main/.test-data/gateway-gui-{packaged,checkout}-smoke.log`。未在用户实际数据目录安装或运行完整安装器 |

当前 EXE：`main/release/gateway-gui-20261010/Lumi-0.5.23-x64.exe`，SHA-256 `943a369a7779dba42d92902326fa21948d2d8557d48019207257f89f15cff173`。构建与校验日志为 `main/.test-data/gateway-gui-exe-{dist,verify}.log`。当前插件为 `release/gateway-gui-20261010/extension.lumi.gateway`，六项资源与冻结源码逐字节一致，当前实际 main 官方校验器通过；同级 `plugin-files-sha256.json` 为原始字节记录。安装方式见包内 README。

核心源码、Cargo 锁定文件和完整许可同步到主程序 `native/gateway-runtime`，可独立构建，不依赖相邻仓库；公开的插件仍按独立目录包交付。版本仍为 0.5.23 和 0.1.0-dev.1，未提交、推送或公开发布。公开 0.5.23 不具有本次开发接口，不能仅按版本号选择宿主。macOS Keychain/ARM64、Linux CI、真实 CLI/提供者和安装升级验证仍待完成；本轮使用隔离 TLS 假上游与 CLI 目录，没有真实密钥或付费请求。

构建时漏设输出目录，覆盖了默认 `main/release` 中原有的本地 0.5.23 安装包、blockmap 和更新元数据；未找到与旧 SHA-256 相同的备份，不能声明已经恢复。本轮新文件已移至上述独立目录，旧开发目录、其他历史目录与公开 GitHub 附件未改变；默认目录中原 SHA256SUMS 保留为历史记录。

## 仓库与实现

主程序 main/public 的基准 HEAD 为 bb15d919262ae4865c2e457714faad6f0831745c，清单 0.5.23；插件仓库 extensions/main 的基准 HEAD 为 c6d26ff9d482fd9aace0ff571b9d47cd9f7d058d。保留主程序既有未提交改动、本地 AGENTS.md 和测试；未暂存、提交、推送、创建标签或发布。

用户批准的固定宿主桥接及 CLI 事务已接入实际 main。独立运行时使用 Rust 核心、Node HTTP/HTTPS 数据与管理服务、Windows DPAPI、AES-GCM/SQLite；中文开发插件位于 sources/extension.lumi.gateway/package-stage，未写入用户实际插件安装目录。旧的临时 host.patch 交付已移除，实际主程序源码为唯一宿主实现。

## 本轮通过

| 检查 | 实际结果 | 证据范围 |
| --- | --- | --- |
| npm run check:gateway | 82 Rust + 42 Node 全过；严格 clippy、核心/fixture 构建通过 | 实际私有管道、loopback HTTP/TLS、假上游 |
| Rust 82 项 | engine 28、observation 16、policy 18、recording 15、secure 5 | tier 字节、增量末尾观测、未知值、AES-GCM/DPAPI、分页、容量、冲突、删除不复活、中断恢复 |
| Node 42 项 | pipe 6、端到端 2、管理 5、传输 22、公共上游 7 | 真实 >2 MiB 三协议末尾观测、~7 MiB 客户端/观察混合背压、取消、认证、配置版本/owner |
| 公共 HTTPS/DNS | 7 项通过 | 全地址审查、每请求重验、固定 lookup、原 TLS 域名、rebinding 拒绝前无凭据发送；没有请求真实提供者 |
| npm run check:gateway-host | 实际 main 完整 TypeScript 0 诊断；65/65 网关回归通过 | contract 13、management 21、pairing 4、CLI 16、process 11 |
| 主程序全量 npm test | 830 项，827 通过、3 跳过、0 失败 | 真正相邻 main 工作树，不再使用虚拟补丁 |
| 主程序 typecheck / check:extensions / build / test:desktop | 全通过 | Vite/Electron 构建、65 份完整依赖许可、隔离正式桌面、safeStorage、IPC、现有插件和独立表面 |
| 真实 Electron 网关联动 | Electron 44.5.0 / Chromium 152；52 次接口调用；进程沙箱、隔离 preload、真实宿主/Frame/SDK/TLS/Rust/系统加密 | 四种 tier 的实际字节、原值/发送/报回分离、正文同意/脱敏/加密、CLI fixture 预览/应用/恢复后停止 |
| 真实 Frame 生命周期 | 页面退出释放会话/订阅且独立监听继续；generation 失效拒旧请求；插件停用停止监听 | 70,293 字节合法网关 DTO 到达主进程；UTF-8 超过 256 KiB 被阻止；其他方法保留原字符上限 |
| 默认沙箱 Chromium 页面回归 | 79 次 SDK 调用、7 次统一配置写入到版本 8、11 张截图，0 错误 | 浅/深、减少动态效果、600 px 四页、分页/范围撤回/删除/导出、正文同意、恢复失败保持监听 |
| iframe 隔离 | 不透明来源、宿主 DOM 拒绝、Node 不可用、直接网络拒绝 | Electron 与 Chromium 的实际 allow-scripts / connect-src none |

主程序全量测试跳过三项：Unix CLI shebang、Swift/AppKit 类型检查和 macOS 原生玻璃生命周期。Windows 结果不替代这些平台检查。

运行时结果：.cache/gateway-validation/result.json（UTC 08:51:26–08:51:45）；增量观察报告 .cache/gateway-validation/incremental-observation.json；实际宿主 .cache/gateway-host-validation.json。主程序全量日志 main/.test-data/gateway-main-final-test.log。Electron 结果 .cache/gateway-plugin-ui/real-electron-vnogMX/result.json，七张截图；页面结果 .cache/gateway-plugin-ui/chromium-XI4fmr/result.json，十一张截图。已目视检查实际记录页和深色窄布局。

真实 Electron 的上游仍是隔离 TLS mock：通过固定、仅测试使用的 HTTPS 地址 dial 适配器连接本地 mock，启用 CA 校验。此结果证明实际宿主链路和协议字节，不冒充公共提供者或真实 Codex/Claude 版本兼容。CLI 的实际服务处理隔离家目录文件，没有执行真实工具或修改用户 CLI 配置。

## 发现并修复

- 管理/转发回归修复活跃规则使用旧检查、取消停止未立即取消、其他 owner 改全局设置；路由 serviceTier=false 保存后实际字节透传。
- 长 SSE 改为固定私有 observe RPC 和有界增量解析。正文捕获满后仍能读取真实终止事件的 tier/usage；无终止、观察过大/失效保持未知。观察停滞一秒后继续完整转发，捕获不完整与观察不完整分别处理。
- 实际 CLI 恢复服务原先返回 recoverable:true，导致“恢复并停止”拒绝停止；现在恢复成功返回 false，并从插件/原生待恢复事务列表消失。真实 Electron 验证恢复完成后才停止监听。
- 插件重扫后丢失、不兼容或 digest 改变时发送 disabled 撤销；未改变的活动包仅更换 generation。管理会话限制全局 64、每 owner 4，异步握手后复查限制。
- Frame 网关输入使用共享 256 KiB UTF-8 字节预算，避免合法大 DTO 被原 64K 限制误拒；其他旧方法行为保留。
- 真实联动发现切换详情期间正文开关读取旧记录；现在同步撤回旧详情。删除开始及成功后均失效化待完成读取，防止迟到结果重新展示已删除正文；新增回归通过。
- 构建 SDK 包含前置界面助手，测试按官方构建形态核对当前 SDK 后缀；首次测试误用原始字节相等断言，修正测试后通过。

## 参考来源核验

网络恢复后实际获取 Magpie/CC Switch 官方仓库的固定完整 SHA，核验路径与根 MIT 许可，见 [源码研究](GATEWAY_REFERENCE_RESEARCH.md)。另实际获取两个 OpenAI 官方 API 页面，核验请求/响应字段、枚举和返回档位可能不同于请求，见 [官方协议核对](GATEWAY_OFFICIAL_TIER_REFERENCE.md)。没有运行上游程序/测试、复制实质源码或发真实 AI 请求。

此前 EPERM、网络和进程启动失败属于旧环境记录，已由本轮实际接入与沙箱成功结果替代。Chromium fixture 的报告不独立证明进程沙箱有效性，进程沙箱证据来自 Electron 实际运行；没有用 --no-sandbox 通过集成检查。

## 仍未完成

1. macOS Keychain、ARM64 原生/DMG 与 Linux CI；真实 Codex/Claude 工具版本和提供者权限/计费兼容。
2. 正式签名、安装/升级与证书轮换验证。完整二进制依赖许可、内置核心及已有实例的路由/凭据增删界面已由上方当前交付完成。
3. WebSocket/Upgrade、全库聚合统计/全文搜索。容量是逻辑数据上限，不代表 SQLite/WAL 物理文件大小；筛选最多扫描 10000 条后显式拒绝。
4. 新宿主尚未公开，host.json 与独立仓库 SDK pin 未更新；没有填写虚构 minHostVersion。开发插件不是已公开安装包，须在首次宿主公开后按两个仓库各自发布流程验收。

本次验证没有使用真实密钥、账户、用户 CLI 家目录或付费模型。工作树保留供审阅，版本不变。

## 自定义规则与本地 EXE 交付（2026-10-10）

用户要求允许自定义 service_tier 并编译 EXE。发送值原本即为自由文本，本轮明确提示：1–64 个 ASCII 字母、数字、点、下划线或连字符，首字符为字母或数字，不按官方枚举限制。实际沙箱 Electron 验证 provider_custom-2026 发送成功并分别保存原值/发送值/报回值；provider_rejected-2026 返回原 400 和 unsupported_service_tier，没有自动换档或重试。最新结果 .cache/gateway-plugin-ui/real-electron-AH4vKk/result.json：66 次 SDK 调用、6 组流程、7 张截图，原四模式、加密正文、CLI、预算和生命周期断言全部通过。

主程序在独立目录 main/release/gateway-dev-20261010 运行 dist，生成 Windows x64 NSIS 安装包 Lumi-0.5.23-x64.exe（111,917,860 字节）。verify:release 校验 77 个当前构建文件、两份既有独立插件、完整许可和无本地数据，通过；再用官方 smoke 流程针对包内 win-unpacked/Lumi.exe 启动，隔离应用/CLI 家目录，通过。日志 main/.test-data/gateway-exe-{dist,verify,smoke}.log。安装包 SHA-256：88ad49c006edf04b79355dff4a304b2be25659dc93ddbcff33e24421e0a4c428。

网关开发目录包位于 release/gateway-dev-20261010/extension.lumi.gateway，六项资源逐字节匹配冻结源码，使用本次实际 main 的官方校验器通过；逐文件 SHA-256 位于同级 plugin-files-sha256.json。这不是公开插件 Release，未更新固定公开宿主、版本、提交或标签。插件需复制到本次 EXE 的额外插件目录并启用，网关伴随程序仍需独立初始化和启动。

## 运行概况配置简化（2026-10-11）

交付版本为模型网关 **0.1.0-dev.6**，配套主程序本地 `gateway-overview-20261011` 构建。运行概况中的 Lumi 节点提供真实网关开关，停止仍需确认；供应商与模型标题旁提供新增入口，单击供应商弹窗编辑，单击模型定位对应编辑行。每个供应商与所属可见模型按实际节点位置连线，缩放后重新计算。

供应商模型行新增“隐藏于概况”，通过宿主的插件独立存储持久化。它不修改模型启用状态，不进入网关配置；被隐藏且启用的模型仍能被 Agent 调用，真实请求信息继续显示。新增供应商自动填写内部 ID 和客户端别名；监听运行时配置入口保留只读检查，修改前先通过 Lumi 开关停止并等待请求结束。未保存编辑阻止直接关闭，取消恢复已保存设置。

当前实际验证结果来自 `.cache/gateway-plugin-ui/real-electron-POcNsf/result.json`：真实生产 ExtensionHost、ExtensionFrame、preload、SDK、TLS 管理服务及配套 EXE 中的 Rust 核心，通过 24 组流程、351 次 SDK 调用、21 个事件与 46 张截图。覆盖开关启动/停止/取消、运行中只读编辑、新增供应商/模型、供应商选择、保存、删除、所有权连线、隐藏设置、取消、重连、完整 iframe 重建、隐藏模型实际转发、链路与退出生命周期。浅/深主题分别覆盖 1280、600、480 像素窗口；供应商弹窗在可见区域内可滚动，连线端点与节点中心一致，无横向溢出。页面错误与外部网络访问均为零；进程与 iframe 沙箱保持开启，Node 关闭。请求仅发往固定本地 TLS 假上游，使用假凭据。

界面回归驱动等待 iframe 完成加载并排除已销毁 frame，对跨 frame 求值设置超时；重建后选择真实规则按钮而非表格行，宿主夹具按实际窗口高度约束滚动容器。此前卡住/视口失败记录不计为成功，以上结果来自修正后的完整执行。

真实保存回归同时发现现有 Rust 核心无法重新解析带小数边界的范围整流规则。本次在用户已明确授权的配置校验/托管运行时范围内修复 `main/native/gateway-runtime/src/rectify.rs`，并在 `provisioning.rs`、`rectifiers.rs` 增加持久化和重启回归；配置与接口保持兼容。Rust 测试 105 项通过，严格 Clippy 通过；独立 Node 运行时测试 91 项通过。主程序全量测试 882 项：879 通过、3 项平台跳过、零失败。

Windows x64 开发安装包位于 `main/release/gateway-overview-20261011/Lumi-0.5.23-x64.exe`（113229642 字节），SHA-256 `969bbaa690689be5eea696aa763c95e5f31d6a508439bfd63db8c071fab89535`。构建、包内许可/资源核验、源码 checkout 与包内 EXE 的隔离桌面启动均通过，日志为 `main/.test-data/gateway-overview-{dist,verify,checkout-smoke,packaged-smoke,main-test,rust-test,rust-clippy}.log`。macOS ARM64 与 Linux 未在本次 Windows 环境执行；该开发构建不等同于公开发布。

`plugins/extension.lumi.gateway`、`release/gateway-overview-20261011/extension.lumi.gateway` 与冻结源码的七项资源逐字节一致；均通过当前主程序官方插件校验器，包指纹 `721284b4e861dc58dee2c58637756f5fadbc576246205d9cc44006dfa1d440ce`。按用户授权自动更新至 `<Lumi 额外插件目录>/extension.lumi.gateway`，逐文件 SHA-256 核验通过。旧版备份与安装收据位于 `.cache/gateway-overview-20261011/`；既有插件设置和实际 CLI 配置不在此更新范围。没有提交、推送或公开发布。

## 供应商目录导入、底部新增卡片与 Lumi 设置（2026-10-11）

模型网关更新为 **0.1.0-dev.7**。模型列表底部的“＋”在选择供应商后自动读取其已保存 API 的模型目录，将新模型加入待保存草稿；供应商编辑中也提供“自动获取模型”与手动添加。按实际模型 ID 去重，保留已有别名、启用和隐藏设置。空目录和错误不删除配置；别名冲突、目录截断与 128 个模型上限均明确提示。API 编辑、取消、弹窗关闭、重连、配置或页面上下文变化会撤回迟到结果；在读取期间编辑模型则合并最新草稿。

供应商和模型的新增入口移到列表最底部，沿用对应节点样式和列宽，高度 30 像素；已有供应商与可见模型的连线保持。点击 Lumi 卡片的符号、文字、地址或留白打开网关设置弹窗，开关单独控制启停。弹窗支持实际参数保存与重新连接、只读查看和未保存修改保护。移除“未确认”兜底文案：未连接与读取状态阶段各自显示，启停以真实状态为准。补齐原开关圆点的颜色变量回退，确保浅深主题中可见。

本轮仅修改独立插件资源、文档和测试。主程序本轮开始时记录的 518 个源码文件保持原始 SHA-256；继续配套上一轮 `main/release/gateway-overview-20261011` 开发 EXE 中的已验证核心，没有重新构建主程序或使用旧测试记录冒充本轮检查。

当前实际验证：

- 真实 Electron **25 组流程、416 次 SDK 调用、58 张截图、42 项视口检查**通过。使用真实 ExtensionHost、ExtensionFrame、生产 preload/SDK、TLS 管理服务、配套 EXE 的 Rust 核心与系统加密；进程及 iframe 沙箱开启，Node 不可用，页面错误与外部网络访问均为零。证据为 `.cache/gateway-plugin-ui/real-electron-PwF6X8/result.json`。
- 默认沙箱 Chromium **17 组流程、353 次 SDK 调用、24 张截图**通过；覆盖目录正常/空/认证失败/无接口/连接错误/截断、去重/别名冲突/容量、取消、读取期间模型编辑、API 变更、关闭重开、重连、页面上下文变化和共享配置版本。证据为 `.cache/gateway-plugin-ui/chromium-FwZvUA/result.json`。该夹具报告不单独证明进程沙箱；进程沙箱证据来自真实 Electron。
- 通过正常 Agent 配置明确授权隔离供应商后，实际转发自动获取模型的别名，并核对发送的真实模型 ID。保留 Agent 鉴权与供应商访问范围；测试使用独立假密钥。目录只发送 GET，没有目录请求引发的推理 POST 或推理记录。
- 浅/深主题分别覆盖 1280、600、480 像素；底部卡片同宽且 30 像素高、实际节点连线、Lumi 符号/文字/地址/留白的坐标点击、开关独立、两类弹窗的视口边界均通过。实际截图已目视检查。隐藏模型、完整 iframe 重建、会话释放与停用生命周期也通过。
- 匹配的当前主程序官方包校验器通过插件仓库目录包和交付目录包；均为七项资源，包指纹 `b496d533d0edb4d75afe969ea3c5a2991c9a796dda9c9d13b5abe8409d8f489d`。真实 Electron 测试包与交付资源逐字节一致。

`npm run check` 本轮实际失败：`host.json` 固定的公开宿主不识别既有网关权限（gateway.control/config/records/cli-config）。这一开发宿主兼容限制没有通过更改 pin 或复制校验规则绕开；当前开发包使用匹配宿主的官方校验器与真实集成验证。公开宿主发布和固定 pin 的更新仍属于独立发布流程，本轮没有公开发布。

排障中失败的输入投递、圆角外命中、错误信息识别和未配置 Agent 权限的转发运行不计为通过；上方结果来自修正后完整执行。宿主 IPC 将带 code 的异常转换为中文字符串，插件兼容固定宿主消息中的错误码，真实认证和目录 HTTP 失败现在有明确提示；宿主源码保持原始字节。

交付目录为 `release/gateway-catalog-20261011/extension.lumi.gateway`；同级保存逐文件 SHA-256、两份真实回归报告、验证证明和安装收据。按此前用户授权自动安装至 `<Lumi 额外插件目录>/extension.lumi.gateway`，由 **0.1.0-dev.6** 更新至 **0.1.0-dev.7**，七项资源均核验通过。旧版备份位于 `.cache/gateway-catalog-20261011/installed-before-20261011-070854-020`。更新没有接触用户 CLI 配置或插件设置存储。

本轮未暂存、提交、推送、创建标签或发布；Windows 验证不替代 macOS ARM64/Linux。测试只使用隔离 TLS 假上游、假凭据和测试家目录，没有真实付费模型请求。

## 自动连接与统一整流界面（2026-10-11）

本轮交付独立插件 **0.1.0-dev.8**。自动管理连接、首次设置后连接、指数退避重试、旧会话和事件释放，以及非敏感编辑草稿保留已经完成。手动连接/断开按钮、供应商列表页与单独 service_tier 编辑/预览已移除。供应商入口统一放在概况中，低频路由/客户端/协议选项折叠到高级设置；客户端认证密钥可自动生成。

已有 service_tier 规则在整流规则里读取、编辑和删除，保留原 ID、范围、优先级及旧配置执行语义，更新沿用原规则事务；新增档位规则使用通用整流。此处是统一界面与兼容管理，不声称已重写旧磁盘配置。主程序的供应商、认证、Agent 和端口在运行中保存限制仍存在；已允许供应商和模型草稿编辑及目录读取。整流和录制仍通过原有接口支持运行中保存。本轮五项宿主文件均与开始时精确备份相同；热更新方案待用户确认，见 GATEWAY_LIVE_CONFIGURATION.md。

实际验证：

- `.cache/gateway-plugin-ui/run-9X2M9N/result.json`：8 组流程通过，覆盖首次设置自动连接、生成客户端认证、统一规则增改删、目录获取、运行中草稿/整流、首次重连失败后的自动重试与草稿保留；默认浅深主题通过，进程及 iframe 沙箱开启。
- `.cache/gateway-plugin-ui/real-electron-oqYIeH/result.json`：真实 ExtensionHost、ExtensionFrame、生产 preload/SDK、TLS 管理端与配套 EXE 内 Rust 核心通过 7 组界面流程、95 次 SDK 调用、13 个事件；实际请求发送了保存后的 flex 档位。页面重建自动连接，旧会话撤回，禁用插件关闭托管核心。
- 默认/梦幻 × 浅/深 × 1280/600/480 像素宽度，共 24 项弹窗检查、48 张截图；人工检查长表单顶部和底部画面。每个弹窗仅有一个面板外框与一个内容滚动区，内部面板边框/背景/虚化已移除；长表单在外框圆角内裁切，窄窗口无横向溢出。真实回归页面错误和外部访问均为 0，Node 关闭，沙箱开启；仅使用工作区隔离数据、假凭据和本机 TLS 假上游。
- 当前主程序官方校验器验证 dev.8 的七项资源通过，指纹 `d77197f7655f08abfe7a646fc97ecb86c89444673d7c35b4469e14131a24858a`；app.js、workbench.js 语法检查与插件仓库 diff 检查通过。`npm run check` 的固定 v0.5.20 校验器拒绝尚未发布的 gateway 权限，该结果不计为通过；不移动 host.json 的公开基准。

真实核心：`E:/workspace/lumi/main/release/gateway-overview-20261011/win-unpacked/resources/native/lumi-gateway-runtime.exe`，SHA-256 `17ccba5111e46871c6e57c8fa67175837582e38466a32c12941cf2d20c048bb0`。本轮不重建未修改的主程序，也不复用旧 Rust/全量测试数字作为本次验证结果。

目录包、插件安装目录与源码七项资源逐字节相同。已按此前自动安装授权更新至 `<Lumi 额外插件目录>/extension.lumi.gateway`，原 dev.7 备份位于 `E:\workspace\lumi\extensions\.cache\gateway-live-20261011\installed-before-dev8-074134347`，收据为 `.cache/gateway-live-20261011/install-receipt.json`。插件设置、网关数据和 CLI 配置未修改。没有提交、推送或公开 Release；不将本机 Windows 结果当作 macOS/Linux 验证。



## Lumi 设置管理接入 API Key（2026-10-11）

模型网关更新为 **0.1.0-dev.9**。接入 API Key 集中放在运行概况中的 Lumi 节点设置弹窗，并排在网关参数之前；移除 Agent 编辑页和供应商客户端认证输入。Agent 节点只展示实际请求，供应商继续管理上游 API key。首次单供应商配置自动建立统一接入，后续供应商自动加入，无需编辑 Agent；首次管理连接后等待真实停止状态再初始化，缺失活动请求观测不假定为零。

Key 与网关参数分别保存，更换时仅通过现有路由事务更新客户端认证，不修改上游认证或应用端口草稿。已保存 Key 不回显，取消不写配置，未保存输入阻止直接关闭；页面、会话和主题/上下文变化清空输入并保留未保存提示。监听期间 Key 为只读，停止且无活动请求后才能更换。客户端需使用新 Key，既有 CLI 接管保留预览、冲突检查、加密备份及重新应用流程。

旧多 Agent 的独立认证与授权范围保留；旧多供应商无 Agent 配置继续使用原专属入口及各自 Key，不自动转换认证方式。自动接入标记只存 ID/引用，不存 Key。仅维护本插件创建的统一接入；供应商删除事务期间阻止后台状态事件重新扩大范围。当前宿主把统一接入凭据放在首条供应商加密认证中，因此该供应商需保留，可停用上游或移除模型；其他新增供应商可正常删除。

本轮实际验证：

- 真实 Electron **14 组流程、175 次 SDK 调用、15 个事件**通过，报告 `.cache/gateway-plugin-ui/real-electron-US0c0j/result.json`。使用真实 ExtensionHost、ExtensionFrame、生产 preload/SDK、TLS 管理服务、系统加密及既有配套 EXE 的 Rust 核心。进程与 iframe 沙箱开启、Node 关闭、页面错误和外部访问为 0。
- 真实更换认证验证：旧 Key 返回 401 且未发送上游，新 Key 返回 200；旧 Agent 越权供应商请求返回 403 且未发送上游。无需 Agent 编辑即可通过统一入口转发配置模型，核对真实上游模型 ID；未更改上游认证。
- 隔离 Electron 界面夹具 **13 组流程、137 次 SDK 调用**通过，报告 `.cache/gateway-plugin-ui/run-gVRHvC/result.json`。覆盖随机初始认证、自动连接/重试、密钥清空/取消/关闭保护、端口草稿保留、旧多入口认证兼容、供应商增删，以及删除期间插入状态事件的并发回归。
- 默认/梦幻 × 浅/深 × 1280/600/480 像素宽度，共 **24 项弹窗检查、48 张截图**通过；已目视检查默认浅色和梦幻深色窄窗口的 Lumi 设置。保持单个弹窗外框与内容滚动区，无横向溢出。
- 当前相邻主程序的官方校验器验证源码、插件目录及交付目录通过，均为七项资源，指纹 `8457e2456fcb9ff0b93514043173955bbdb3ba6b4b38179d8b35d25aa500b324`。七项资源与本轮真实 Electron 测试包逐字节一致。
- 本轮实际 `npm run check` 未通过：`host.json` 固定的 v0.5.20 校验器不识别已有网关权限。没有移动公开宿主 pin 或复制替代解析规则；开发包需当前配套网关开发版宿主。

交付目录为 `release/gateway-access-20261011/extension.lumi.gateway`，同级保存两份测试报告、逐文件 SHA-256 与 `verification.json`。运行时二进制 SHA-256 为 `17ccba5111e46871c6e57c8fa67175837582e38466a32c12941cf2d20c048bb0`，继续使用 `main/release/gateway-overview-20261011` 的既有本地 EXE。本轮未修改或重新构建主程序源码，未更新用户 AppData 中的插件目录，未提交、推送或公开发布。仅使用工作区隔离数据、假凭据及本机 TLS 假上游，没有真实 CLI 家目录或付费请求；Windows 结果不替代 macOS/Linux。


## 自动生成接入密钥与紧凑概况（2026-10-11）

模型网关更新为 **0.1.0-dev.10**，使用现有宿主接口，未修改或重新构建主程序。Lumi 设置与首次设置均提供“自动生成”按钮，以加密随机源产生 32 字节（256 位）密钥，只填入密码输入草稿；连续生成替换草稿，明确保存后才更换认证。保留取消、关闭保护、上下文/页面/会话清空、运行中只读及旧接入授权范围，首次留空保存仍自动生成。

概况顶部集中展示实际监听状态与开关、管理端 HTTPS 地址、OpenAI/Anthropic Base URL、活动请求与录制状态。关闭监听时，接入地址明确标为已配置而不可用；未连接时撤回接入地址，管理端地址为已保存配置。旧专属入口同步显示所选供应商路径。Lumi 节点继续打开设置，不再承载监听开关。

Agent—Lumi、Lumi—各供应商、供应商—各可见模型共用曲线绘制方式，缩放与目录滚动后按实际边界重绘，实际请求对应路径高亮，连线不拦截节点点击。供应商节点在其模型分组内随目录滚动保持可见。减少节点高度与间距，合并统计和状态行，空请求列表、时间线、整流明细及无实际请求时的供应商/模型选择不占空间，移除多余概况状态卡片。

本轮实际验证：

- 真实 ExtensionHost、ExtensionFrame、生产 preload/SDK、TLS 管理服务、系统加密与既有 Rust EXE：**18 组流程、183 次 SDK 调用、17 个事件**通过。自动生成 Key 保存前无认证写入；保存后旧 Key 返回 401 且未触达上游，新 Key 返回 200 且保持供应商认证；运行中生成按钮与 Key 保存均只读。
- 默认/梦幻 × 浅/深 × 1280/600/480 窗口，包含目录滚动前后：**24 项连线与顶部连接检查、24 项弹窗布局检查、49 张截图**。核验所有模块曲线端点、模型归属、多供应商分支、无横向溢出和单个弹窗滚动区；已目视检查单模型空闲概况与梦幻深色窄窗口的密钥按钮。
- 单供应商、单模型、无实际请求的概况，在实际 iframe 宽 1215px 时面板高 **443.0px**，三段连接齐全。多供应商按内容增长，不套用单供应商高度阈值。
- 隔离 Electron RPC 夹具：**15 组流程、149 次 SDK 调用、6 项浅深/宽窄布局检查**通过；保留随机生成、取消/清空、草稿保护、独立 Key 事务、旧权限和自动重连回归。两组最终报告错误与外部访问均为 0，进程与 iframe 沙箱开启，Node 关闭。
- 官方相邻开发宿主校验器验证源码、插件目录和交付目录的七项资源均通过，交付字节与最终真实集成测试包完全一致。语法与 Git diff 检查通过。
- 本轮实际运行 npm.cmd run check 仍失败：host.json 固定的 v0.5.20 不识别既有 gateway 权限。未移动公开宿主基准，开发目录包继续配套 gateway-overview-20261011 本地 Lumi 构建。

最终真实报告：.cache/gateway-plugin-ui/real-electron-THUlOI/result.json；夹具报告：.cache/gateway-plugin-ui/run-5Q9yat/result.json。交付目录 release/gateway-layout-20261011/extension.lumi.gateway；同级保存报告、单模型测量、两张界面预览、逐文件 SHA-256 及 verification.json。本轮复用运行时 SHA-256 17ccba5111e46871c6e57c8fa67175837582e38466a32c12941cf2d20c048bb0，不将旧 Rust/主程序全量测试计为本次验证。仅使用隔离数据、假凭据、本机上游与端口，没有真实 CLI 或付费请求。Windows 结果不替代 macOS/Linux。未提交、推送或公开发布；安装状态由本轮 install-receipt.json 记录。

安装完成：按既有替换流程更新用户插件目录为 dev.10，七项资源的 SHA-256 与最终测试/交付包一致，安装目录通过当前开发宿主官方校验器。dev.9 备份位于 E:\workspace\lumi\extensions\.cache\gateway-layout-20261011\installed-before-dev10-083050993；收据位于 E:\workspace\lumi\extensions\.cache\gateway-layout-20261011\install-receipt.json。在 Lumi 中重新扫描并启用模型网关后生效。

## Lumi 节点开关与右侧滚动遮挡修复（2026-10-11）

模型网关更新为 **0.1.0-dev.11**。监听开关放回 Lumi 节点，概况顶部继续显示实际监听状态、管理连接与 OpenAI/Anthropic 接入地址。卡片的设置按钮与监听开关使用独立点击区域，启停仍读取实际状态并保留停止确认。

插件的完整视口滚动容器预留 12px 右侧间距，使用稳定滚动槽与 8px 滚动条；滚动条颜色使用主题正文颜色以提高透明背景下的辨识度。修复右侧面板边缘被滚动区域覆盖的问题，不增加概况面板高度。测试夹具加载主程序已有的 extension-layout.css，使完整视口容器与实际主程序一致；本轮没有修改主程序源码、宿主接口、权限或运行时。

实际验证：

- 真实 Electron **20 组流程、183 次 SDK 调用、17 个事件**通过。用真实鼠标坐标点击 Lumi 卡片的留白、图标、标题、描述打开设置；实际坐标点击监听开关完成启动与确认停止，开关不误开设置。使用真实 ExtensionHost、ExtensionFrame、生产 preload/SDK、TLS 管理服务、系统安全存储和既有 Rust 核心。
- 默认/梦幻 × 浅/深 × 1280/600/480 窗口、目录滚动前后，共 **24 项概况检查、24 项弹窗检查、49 张截图**。所有开关点击目标正确，右侧独立间距保持，模块连线端点与实际节点一致，无横向溢出；目视检查梦幻深色宽/窄窗口。单模型空闲面板高 443.0px，继续保持紧凑布局。
- 隔离 Electron RPC 夹具 **15 组流程、149 次 SDK 调用、6 项浅深/宽窄检查**通过。两份最终报告错误与外部访问均为零；Electron 和 iframe 沙箱开启，Node 关闭。
- 源码、插件目录与交付目录的七项资源逐字节匹配最终真实回归包，并通过当前相邻开发宿主的官方插件校验器。JavaScript 语法与 Git diff 检查通过。
- 本轮实际执行 npm.cmd run check 未通过：host.json 固定 v0.5.20 的公开校验器不识别已有 gateway 权限。没有移动公开宿主 pin；目录包继续配套 gateway-overview-20261011 本地开发版。

最终真实报告：.cache/gateway-plugin-ui/real-electron-vohS23/result.json；夹具报告：.cache/gateway-plugin-ui/run-jb0jBq/result.json。交付目录：release/gateway-lumi-toggle-20261011/extension.lumi.gateway。运行时复用 SHA-256 17ccba5111e46871c6e57c8fa67175837582e38466a32c12941cf2d20c048bb0，不将过往主程序/Rust 验证计为本次执行。仅使用隔离工作区、假凭据和固定本机假上游，没有真实 CLI 配置或付费请求。Windows 结果不替代 macOS/Linux。没有提交、推送或公开发布；安装由本轮 install-receipt.json 记录。


安装完成：用户插件目录现为 **0.1.0-dev.11**，七项资源与最终测试/交付包逐字节和 SHA-256 一致，安装目录通过配套开发宿主官方校验器。旧版 0.1.0-dev.10 备份：E:\workspace\lumi\extensions\.cache\gateway-lumi-toggle-20261011\installed-before-dev11-084248211；安装收据：.cache/gateway-lumi-toggle-20261011/install-receipt.json。重新扫描并启用模型网关后生效。


## 2026-10-11：dev.12 概况填满与两列地址

本轮只修改网关插件页面与界面回归，主程序的相关七项源码 SHA-256 与本轮开始时一致。保存前模型查询和先前待确认的热保存方案未实施，不能将界面检查当作这些宿主功能已完成的证据。

- chain-panel 填满当前宿主视口的剩余高度；页面固定保留底部 16px，并为原页脚保留正常布局间距。右侧继续保留 12px 内边距和稳定滚动条槽。矮窗口与窄窗口保留内容自然高度并可滚动。
- 概况说明仅保留 OpenAI / Anthropic 两列 Base URL。管理端、实际监听地址、活动请求、录制和安全存储状态移动至 Lumi 设置中的折叠“运行状态”。高级停止操作移动到“接入与设置”。网关开关继续位于 Lumi 节点。
- 真实 Electron：20 组流程、26 项概况检查、24 项弹窗检查通过；覆盖默认和梦幻界面、浅深主题、1280/600/480 宽度，以及额外 700/1200 高度检查。真实 TLS 管理、Rust 核心、系统加密、生产 preload/SDK 和渲染沙箱均参与，错误与资源拦截为空。
- 隔离 RPC 界面夹具：15 组流程、6 项概况检查通过。source、plugins、交付副本和用户安装目录的七项资源 SHA-256 相同；源文件语法检查通过。匹配本地主程序官方校验器对开发包与安装目录均通过，digest 为 a71f34717b42e3d0751b96c5fa08fb0134f39d636f32a8261ccaca1b4503b25f。
- npm run check 实际执行失败：固定 v0.5.20 校验器不认识开发网关五项权限，保持既有兼容边界，没有删权限或改变固定宿主。
- dev.12 已安装并备份 dev.11，需在 Lumi 中重新扫描并重新启用。没有提交、推送或公开发布。

验证与截图：release/gateway-fill-20261011/verification.json；真实回归输出：.cache/gateway-plugin-ui/real-electron-WFMS2c/result.json；夹具输出：.cache/gateway-plugin-ui/run-vpRluw/result.json；安装收据：.cache/gateway-fill-20261011/install-receipt.json。

保存前模型查询的具体宿主接口、改动范围、凭据生命周期与验证计划见 GATEWAY_DRAFT_MODELS.md。热保存继续见 GATEWAY_LIVE_CONFIGURATION.md。


## 保存前目录查询、全配置热保存、生成 Key 回显与上游错误修复（2026-10-11）

本轮用户明确允许按 GATEWAY_DRAFT_MODELS.md 与 GATEWAY_LIVE_CONFIGURATION.md 联动修改 Lumi 宿主与 Rust 网关核心、重建配套 Windows 开发安装包并自动更新插件。独立插件为 **0.1.0-dev.13**，配套 Lumi 清单版本仍为 **0.5.23**；开发包包含本轮新宿主实现。两仓库保留已有工作区修改，没有暂存、提交、推送、标签或公开 Release。

新增供应商使用 `gateway.routes.models.preview` 在受限宿主中读取目录；本次 Key 仅在内存使用，不创建临时供应商、不写配置/认证/storage/请求记录、不启停数据监听。严格校验 ID、版本、协议、公共 HTTPS、ASCII Key 与有界输出。已保存的 detect 接口保持兼容；旧 SDK 明确回退，目录读取不产生推理 POST。

运行中供应商、模型、Key、Agent、整流、录制、名称、请求大小/并发与双端口均可保存。私有 native prepare/commit/cancel 事务先完成配置、凭据、数据/管理端口和加密配对文件检查，再提交；冲突、端口占用或写入失败保留原配置与监听。请求从 HTTP 接收起固定配置、模型、认证、整流、大小限制及录制策略，读请求体期间变更不会串用新配置。端口切换让原 JSON/SSE 完成，管理会话自动重连，同一个核心进程保留请求和记录。

自动生成接入 Key 后明文显示并可复制；保存后在当前 Lumi 设置中保留本次生成结果，首次留空自动生成同样回显。关闭、取消、接入切换和上下文变化撤回显示，不从宿主读回既有凭据，不持久化至插件 storage 或日志。真实测试检查选中内容和复制控制，使用隔离复制命令替身保留用户系统剪贴板。

对 HTTP 404、429、502 等非成功上游响应保留原状态、响应头和字节，避免错误流被成功转换器误报为 conversion-incomplete-stream，不自动重试其他推理入口。上游明确给出 finish_reason 的 Chat 流可在正常 EOF 收尾；keep-alive、部分内容或缺少结束原因的 DONE 仍失败。供应商模型目录并不证明支持 Responses；在高级上游推理接口中选择该服务真实支持的路径。本轮故障检查只读协议/接口配置及请求状态元数据，未修改用户网关配置，未使用真实凭据进行推理。

实际验证：

- 主程序最终 **893 项：890 通过、3 项既有条件跳过、0 失败**，日志 `.test-data/gateway-deepseek-20261011/node-all-final.log`。类型检查、生产构建、内置插件校验和完整许可生成通过。初次全量回归发现热保存测试在原生记录释放并发槽位前检查大小限制，收到 429；补上实际监听 activeRequests=0 的有界等待，保留 413 断言后重新完整执行，最终全部通过。
- 当前相关专项 **28 项**全部通过，日志 `.test-data/gateway-deepseek-20261011/targeted-final.log`；覆盖慢请求体/长 JSON/SSE、认证与模型/协议切换、录制快照、供应商与 Agent 引用、双端口与占用、版本冲突、原生及加密配对写入失败回滚、草稿 OpenAI/Anthropic 目录、反射凭据/跳转/并发/迟到结果，以及 HTTP 404/429/HTML 与明确结束/真正截断的流。
- 本轮原生实现的 **108 项 Rust 回归**与 `clippy --all-targets -- -D warnings` 通过，日志 `.test-data/gateway-hot-draft-20261011/rust-test.log`、`rust-clippy.log`。后续上游错误修复仅修改 Node 传输与转换层，未再改原生源码。
- 最终真实 Electron **23 组流程、210 次 SDK 调用、16 个事件、53 张截图、26 项概况和24 项弹窗检查**通过，报告 `.cache/gateway-plugin-ui/real-electron-h0qPgs/result.json`。真实 ExtensionHost/ExtensionFrame、生产 preload/SDK、TLS 管理、最终安装包的 Rust 核心与系统加密均参与。进程/iframe 沙箱开启，Node 关闭，页面错误与资源拦截为空。默认/梦幻 × 浅/深 × 1280/600/480 宽度及额外高度验证；最终测试包的七项资源与 source、plugins、交付和安装目录逐字节一致。
- 隔离界面夹具与旧 SDK 回退各 **18 组**通过，报告 `.cache/gateway-plugin-ui/run-t5tRmZ/result.json` 与 `run-b7uq8y/result.json`。保留取消、关闭/重建、草稿变更、复制反馈及自动重连检查。
- 官方相邻开发宿主校验器通过源码、插件目录、交付目录和安装目录，七项资源的包指纹 `0d8260acd3f057461454b50d8c8d57f7b9a281030d0ceb387471abe7c958c1d7`。本轮实际执行过 `npm run check`，固定 v0.5.20 校验器仍不识别既有网关权限；未移动 host.json 或复制解析规则。开发插件需要本次配套宿主。
- 当前源码 checkout 的官方 `test:desktop` 与最终 `win-unpacked/Lumi.exe` 的同等隔离冒烟均通过；安装包 `verify:release` 核对78个构建文件、2项既有独立发行资源、完整许可与不含本机数据。日志 `.test-data/gateway-deepseek-20261011/desktop-final.log`、`packaged-desktop-final.log`、`verify-release-final.log`。

配套 EXE：`main/release/gateway-hot-draft-20261011/Lumi-0.5.23-x64.exe`，113235988 字节，SHA-256 `dd48d88748779feb0f7c26f790a7c7b5cc65b9be937050e7972b1b26b5024556`。安装器未执行，校验清单位于其同级。交付插件 `release/gateway-hot-draft-20261011/extension.lumi.gateway`，同级 verification.json 保存两仓库实际证据和全部资源 SHA-256。

插件已按既有授权由 dev.12 更新为 **dev.13**，七项资源安装后 SHA-256 一致；目标 `<Lumi 额外插件目录>/extension.lumi.gateway`，备份 `E:\workspace\lumi\extensions\.cache\gateway-hot-draft-20261011\installed-before-dev13-101149502`，收据 `.cache/gateway-hot-draft-20261011/install-receipt.json`。需安装本次配套 EXE，在 Lumi 中重新扫描并重新启用插件。用户插件设置、网关配置、CLI 与账户数据未修改。本轮仅验证 Windows；macOS ARM64/Linux 未在此环境执行。

## 完整模型图、请求卡片与活动线路（2026-10-11，dev.14）

本轮按已有宿主链路改动与自动安装授权交付独立插件 **0.1.0-dev.14**，配套主程序仍为 **0.5.23 开发构建**。移除目录固定 320px 高度，根元素滚动规则提高到足以覆盖宿主默认选择器的优先级，整页可到达最后一个模型、添加行与请求卡片。请求卡片逻辑高度 64px，按完整可见数量限制历史，进行中的请求优先；窗口宽度变化重新计算容量，扣除行内边距，不留下半张卡片。详细时间线默认折叠。

新增宿主只读实时观测：最近 5000ms 实际输出 Unicode 字符数 / 观测时长，单位 **字符/s**。不足 5 秒使用已观测时长，完成后冻结，缺失/失败/编码不支持/旧宿主保持未知。JSON 完整内容只在到达时计量；SSE 只计入生成的文本、工具参数及可观测思考增量，不计心跳、消息数量和上游汇总 token。瞬时解析正文，仅保留有限时间戳与数量，摘要不含正文；token 用量保持上游原报值。链路快照保留最多 128 项活动及 64 项完成请求，192 KiB 总预算先撤回历史再精简诊断，保留活动身份；800ms 可见页面轮询即使 revision 不变也更新速率和宿主单调耗时。

全部活动请求、供应商、模型线路同时着色。被用户隐藏的活动模型临时显示，完成后恢复原偏好。供应商编辑增加实际推理地址预览；已有用户记录中的 404 为上游返回，最近一次为 `/v1/chat/completions`，没有重复 `/v1`。本轮使用假上游复现相同 `bad_response_status_code`，确认原始 HTTP 404/正文单次转发，界面显示错误来源；不声称修复供应商自己的接口、权限或模型配置，不更改用户供应商设置、不发付费探测或自动重试。

本轮实际验证：

- 主程序 `npm run typecheck`、完整 `npm test`：901 项，**898 通过、0 失败、3 跳过**。初次全量运行发现 SDK 文档声明不同步，修复后最终完整运行如上；日志 `.test-data/gateway-cards-full-tests.log`。
- 新增 live-metrics 回归覆盖 5 秒过期、空闲更新、结束冻结、拆分 UTF-8/CRLF、文本/工具/思考、非内容 SSE、未知数据、重复字段/过大帧与样本预算、长请求超出后续 64 项完成历史、最坏大小下全部 128 活动身份，以及严格可选 DTO 和旧宿主兼容。
- 最终轻量界面夹具 `.cache\gateway-plugin-ui\run-yDqX6d/result.json`：21 组流程，默认浅深主题与 1280/600/480 宽度；活动优先、可见窗口、同时高亮和结束撤回通过。
- 最终真实回归 `.cache\gateway-plugin-ui\real-electron-2ugrXV/result.json`：25 组界面流程、227 次生产 SDK 调用、28 个事件；真实 ExtensionHost、ExtensionFrame、生产 preload/SDK、TLS 管理端与 **新安装包内** Rust 核心。默认/梦幻 × 浅/深 × 三种宽度，24 项弹窗、26 项概况检查和 67 张截图；滚动到底的模型/曲线端点、空隙与卡片完整边界通过。真实两个并行 SSE 初始输出分别 2/3 字符，空闲超过 5 秒窗口归零且 revision 不变，新输出回到 0.8 字符/s，结束各自撤回高亮并冻结；上游报回 77 token 保留为独立原值。页面错误和外部访问为 0，沙箱/上下文隔离开启，Node 关闭。人工检查活动卡片、默认/梦幻底部画面。
- `npm run dist`、`npm run test:desktop`、`npm run verify:release` 通过。安装包匹配 78 项构建资源，保留 65 项 JS 依赖与 84 项网关依赖完整许可，不含本地数据；桌面检查按官方脚本启动 checkout 构建，不误写为已安装 EXE 测试。Windows x64 安装包：`release/gateway-cards-20261011/Lumi-0.5.23-x64.exe`，SHA-256 `a23c8f58e69e04f712b87ab2d0a09313ba710fca941085d5e060a74915fa14d0`。实际包内核心 SHA-256 `577ebc44f802d78ba88673cbb4c6245fbcb8a7b9095b5c232441798a628d0172`。
- 当前宿主官方校验器验证插件七项资源通过，指纹 `9787591307d873fd573fc932226270a799981d0a410448ca87b7641f96e43fd4`；两个插件脚本语法、两仓库 diff 检查通过。独立插件 `npm run check` 的固定 v0.5.20 校验器仍拒绝尚未发布的 gateway 权限，该检查明确未通过，未移动 host.json 的公开基准。

源码、目录包、本地交付目录、真实回归资源与安装目录七项资源逐字节相同。已安装到 `<Lumi 额外插件目录>/extension.lumi.gateway`，先前 dev.13 备份为 `E:\workspace\lumi\extensions\.cache\gateway-cards-20261011\installed-before-dev14-105814843`，收据 `.cache/gateway-cards-20261011/install-receipt.json`。需安装配套新宿主并重新扫描/启用插件才能使用窗口观测；旧宿主显示未知。保存、目录查询、配置、CLI 与付费上游均仅在工作区隔离夹具验证。没有暂存、提交、推送、标签或公开 Release；没有 macOS/Linux 本轮运行结果。
