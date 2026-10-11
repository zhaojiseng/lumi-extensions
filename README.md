# Lumi 额外插件

Lumi 官方维护的独立功能插件和界面插件。每个插件独立版本、独立发布，不编译进 Lumi 安装程序。

主程序与插件宿主：[zhaojiseng/lumi](https://github.com/zhaojiseng/lumi)。

| 插件 | 类型 | 功能 | 权限 | 已验证基准 |
| --- | --- | --- | --- | --- |
| [工作台便笺](plugins/extension.lumi.notes) | 功能 | 工作台、侧栏和设置中的便笺 | storage | Lumi 0.5.1 / API v1 |
| [Codex 对话](plugins/extension.lumi.codex) | 功能 | 经宿主默认桥接与本机 `codex app-server` 对话，复用当前皮肤：流式回复、命令执行、diff、计划、审批与会话历史 | codex.bridge | Lumi 0.5.19 / API v1 |
| [模型网关](plugins/extension.lumi.gateway) | 功能 | 统一接入、供应商与模型、两段整流、多协议转换及本地请求记录 | gateway.* 五项权限、storage | Lumi 1.0.0 / API v1 |
| [紧凑界面](plugins/extension.lumi.compact) | 界面 | 紧凑侧栏、间距与强调色 | 无 | Lumi 0.5.1 / API v1 |
| [浮梦 · 梦幻界面](plugins/extension.author.dreamy) | 界面 | 可配置液态玻璃、同步弹窗虚化与圆角框架 | 无 | Lumi 0.5.13 / API v1 |

## 目录与修改入口

| 目录 | 用途 | 网关当前入口 |
| --- | --- | --- |
| `sources/` | 开发工程、测试与开发说明 | 页面在 `sources/extension.lumi.gateway/package-stage/` 修改 |
| `plugins/` | 当前可直接安装的插件目录包 | `plugins/extension.lumi.gateway/`，从页面源目录同步七个文件 |
| `release/` | 按版本或日期保存的交付副本、ZIP 与校验文件，Git 忽略 | 正式发布包为 `release/extension.lumi.gateway-v1.0.0.zip` |
| `.cache/` | 固定宿主、编译缓存、隔离测试结果与截图，Git 忽略 | 不作为安装目录或开发入口 |

网关页面的维护顺序是 `sources/.../package-stage → plugins/extension.lumi.gateway → release/<交付批次>`。只在页面源目录修改，再验证、同步；安装时复制 `plugins` 中整个同 ID 文件夹。`release` 中已有交付副本保留原样。其他没有独立开发工程的插件直接在自己的 `plugins/<ID>/` 中维护。

完整目录树、网关核心与主程序的边界、校验命令见 [目录结构与维护入口](docs/DIRECTORY_STRUCTURE.md)。

## 安装

1. 从 [Releases](https://github.com/zhaojiseng/lumi-extensions/releases) 下载所需插件 ZIP；首次发布前也可直接复制本仓库 `plugins/<插件ID>/`。
2. 解压，得到含 `plugin.json` 的插件目录。
3. 在 Lumi 的常规设置中打开“额外插件目录”，复制完整插件目录进去。
4. 点击“重新扫描”；启用功能插件，或在“界面插件”中选择界面包。

安装目录应为 `<额外插件目录>/<插件ID>/plugin.json`。用户不需要 Node.js 或 npm。插件文件变化后需要重新扫描和启用；替换插件保持原 ID 才能保留宿主按 ID 保存的数据。

## 开发与校验

使用 Node.js 24+、npm 11+ 和 Git：

```sh
npm ci --ignore-scripts
npm run setup:host
npm run check
npm run check -- plugins/extension.lumi.notes
```

`host.json` 固定 Lumi v1.0.0 的完整提交 SHA。准备命令只在忽略的 `.cache/` 下获取宿主源码和校验依赖，不下载或启动 Electron；校验直接复用该版本宿主的官方规则。SDK 类型在 `sdk/lumi-extension.d.ts`，运行时 `lumi-sdk.js` 由 Lumi 提供。

模型网关 1.0.0 的最低宿主为 Lumi 1.0.0；API 版本仍为 1。`npm run check` 使用固定官方宿主校验全部插件，真实网关界面与运行时还需单独执行回归，具体命令见 [目录说明](docs/DIRECTORY_STRUCTURE.md)。

`plugins/` 只保存可直接安装的目录包。需要 React/TypeScript 构建的插件可把开发工程放到 `sources/<插件ID>/`，将自包含 web 资源输出到对应 `plugins/<插件ID>/`。不要将依赖树、缓存、密钥或用户数据放入插件包。

完整外部接口及沙箱边界见 [Lumi v1.0.0 插件开发指南](https://github.com/zhaojiseng/lumi/blob/v1.0.0/docs/PLUGIN_DEVELOPMENT.md)。外部插件不能自行注册主进程能力或访问任意文件系统；Codex、网关等能力只通过宿主已实现且经过权限校验的固定接口提供。界面插件只提供受校验的 CSS。

## 独立发布

每个插件在 `plugin.json` 中维护自己的版本，仓库 `package.json` 版本不代表插件版本。提交修改后：

```sh
npm run package -- extension.lumi.notes
git tag extension.lumi.notes-v1.0.0
git push origin extension.lumi.notes-v1.0.0
```

打包生成 `release/<插件ID>-v<版本>.zip` 和对应 `.sha256`。ZIP 只包含该插件目录，不含宿主、开发源码或仓库工具。当前自动化模板尚未启用，推送标签不会自动发布插件。使用已有 GitHub CLI 登录手动创建草稿、上传 ZIP 与 `.sha256`，下载草稿附件核对 SHA-256 后公开；目标插件依赖的新宿主须先公开。标签提交中其他插件保持各自版本。

## 自动化模板

`.github/workflow-templates/` 包含提交/PR 校验和按插件标签发布的 GitHub Actions 模板。模板当前尚未启用，插件 Release 采用上述手动流程。

维护者补齐凭据权限后，将两份 YAML 复制到 `.github/workflows/` 并提交推送即可启用。使用 GitHub CLI 时，可运行 `gh auth refresh -h github.com -s workflow` 和 `gh auth setup-git` 更新登录及 Git 凭据配置。该步骤需要在 GitHub 完成授权。

校验覆盖包结构和宿主清单契约；界面布局、CSS 合法性及实际 SDK 行为还需在安装的 Lumi 中手动验证。贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。
