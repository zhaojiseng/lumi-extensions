# 梦幻界面 1.1.10 发布验收

本次只发布 `extension.author.dreamy`，其余插件版本和安装包不变。最低宿主仍为 Lumi 0.5.20，推荐 Lumi 1.0.4；不增加权限，不携带宿主源码或 SDK 运行时。

## 本机验证

2026-10-14 在 Windows x64、Node.js 24 环境执行。真实 UI 使用相邻主程序 Lumi 1.0.4，提交 `2cedd36024083da3ee17ef5f3f3547b9a6adaafe`；官方清单校验继续使用 `host.json` 固定宿主。

| 检查 | 结果 | 本地证据（忽略目录，不随包分发） |
| --- | --- | --- |
| `npm.cmd run check` | 5 个插件通过 | `.cache/release-1110-check.log` |
| `npm.cmd run check:dreamy-ui -- ..\main --hardware` | 浅深主题、模糊开关逐帧、退出生命周期、焦点、原生选择器、窄窗及辅助显示通过 | `.cache/release-1110-ui-hardware.log` |
| `npm.cmd run check:dreamy-solid-ui -- ..\main --hardware` | 36 场景通过；与基线 `b9c034be878579897152a8cb890c84a02dbc1e1c` 对照，正文、实色内部和阴影区域像素一致，仅圆角抗锯齿有局部差异 | `.cache/release-1110-solid-hardware.log` |
| `npm.cmd run check:dreamy-market-ui -- ..\main --hardware` | 8 场景通过；保持清晰度门限 0.8 | `.cache/release-1110-market-hardware.log` |

Lumi 1.0.4 本机全量 921 项测试中 918 通过、3 项平台跳过、0 失败，类型检查、内置插件检查、硬件真实预览、Windows 安装包、隔离桌面启动、包内完整许可及安全扫描通过。主程序三平台与 macOS ARM64 包的实际结果以主程序标签工作流为准，不能由本机检查替代。

## 发布状态

发布提交、包与标签按仓库独立执行；从干净提交打包并校验 ZIP 与 Git 原始字节。插件草稿附件校验完成后，等待 Lumi 1.0.4 公开再发布。公开附件及 SHA-256 验收将在完成后补记。
