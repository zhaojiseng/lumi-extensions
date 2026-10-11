# 贡献插件

官方维护的插件放在 `plugins/<插件ID>/`。第三方作者可在自己的仓库独立发布，无需将所有插件集中到此仓库。

开发工程、当前安装包与交付副本的职责见 [目录结构与维护入口](docs/DIRECTORY_STRUCTURE.md)。网关页面在 `sources/extension.lumi.gateway/package-stage/` 修改并验证，再同步到 `plugins/extension.lumi.gateway/`；不要两处分别修改。模型网关 1.0.0 要求 Lumi 1.0.0 或更新宿主；使用 `host.json` 固定的官方校验器，并在匹配主程序上执行真实界面回归。

1. 使用稳定的 `extension.<作者>.<名称>` ID，目录名称与 ID 一致。
2. 提供 `plugin.json`、自包含运行资源、完整 `LICENSE` 和安装/功能说明。
3. 按实际需要声明最低权限，说明数据来源、网络来源和凭据用途。
4. 修改已发布插件时更新插件自己的 `version`，保留 ID。构建依赖和第三方资源的许可随安装包分发。
5. 运行 `npm run check`，在已安装的 Lumi 中验证实际界面和 SDK 行为，记录版本与截图。
6. 提交 PR，描述功能、权限、构建方法、许可与验证结果。

SDK 和包校验规则由主程序维护。升级时更新 `host.json` 的发布版本及完整提交 SHA，重新准备宿主、同步对应 SDK 类型并验证全部插件。不要复制一份独立的宿主解析规则。

严禁提交账户密钥、会话正文、个人数据、node_modules 或构建缓存。插件包不提供 Node.js、shell、任意 IPC 或主窗口 DOM 权限。
