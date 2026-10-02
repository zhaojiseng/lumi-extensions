# Lumi 额外插件

Lumi 官方维护的独立功能插件和界面插件。每个插件独立版本、独立发布，不编译进 Lumi 安装程序。

主程序与插件宿主：[zhaojiseng/lumi](https://github.com/zhaojiseng/lumi)。

| 插件 | 类型 | 功能 | 权限 | 已验证基准 |
| --- | --- | --- | --- | --- |
| [工作台便笺](plugins/extension.lumi.notes) | 功能 | 工作台、侧栏和设置中的便笺 | storage | Lumi 0.5.1 / API v1 |
| [紧凑界面](plugins/extension.lumi.compact) | 界面 | 紧凑侧栏、间距与强调色 | 无 | Lumi 0.5.1 / API v1 |
| [浮梦 · 梦幻界面](plugins/extension.author.dreamy) | 界面 | 柔彩背景、磨砂组件、圆角框架与统一侧栏宽度 | 无 | Lumi 0.5.1 开发版 / API v1 |

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

`host.json` 固定 Lumi v0.5.1 的完整提交 SHA。准备命令只在忽略的 `.cache/` 下获取宿主源码和校验依赖，不下载或启动 Electron；校验直接复用该版本宿主的官方规则。SDK 类型在 `sdk/lumi-extension.d.ts`，运行时 `lumi-sdk.js` 由 Lumi 提供。

`plugins/` 只保存可直接安装的目录包。需要 React/TypeScript 构建的插件可把开发工程放到 `sources/<插件ID>/`，将自包含 web 资源输出到对应 `plugins/<插件ID>/`。不要将依赖树、缓存、密钥或用户数据放入插件包。

完整外部接口及沙箱边界见 [Lumi v0.5.1 插件开发指南](https://github.com/zhaojiseng/lumi/blob/v0.5.1/docs/PLUGIN_DEVELOPMENT.md)。外部插件目前不能注册主进程能力、写入 CLI 配置或访问任意文件系统；界面插件只提供受校验的 CSS。

## 独立发布

每个插件在 `plugin.json` 中维护自己的版本，仓库 `package.json` 版本不代表插件版本。提交修改后：

```sh
npm run package -- extension.lumi.notes
git tag extension.lumi.notes-v1.0.0
git push origin extension.lumi.notes-v1.0.0
```

打包生成 `release/<插件ID>-v<版本>.zip` 和对应 `.sha256`。ZIP 只包含该插件目录，不含宿主、开发源码或仓库工具。启用下述自动化后，标签会验证清单版本并自动发布该插件的 GitHub Release；标签提交中其他插件保持各自版本。

## 自动化模板

`.github/workflow-templates/` 包含提交/PR 校验和按插件标签发布的 GitHub Actions 模板。当前创建仓库的 GitHub 凭据缺少 `workflow` 权限，因此模板尚未启用。

维护者补齐凭据权限后，将两份 YAML 复制到 `.github/workflows/` 并提交推送即可启用。使用 GitHub CLI 时，可运行 `gh auth refresh -h github.com -s workflow` 和 `gh auth setup-git` 更新登录及 Git 凭据配置。该步骤需要在 GitHub 完成授权。

校验覆盖包结构和宿主清单契约；界面布局、CSS 合法性及实际 SDK 行为还需在安装的 Lumi 中手动验证。贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。
