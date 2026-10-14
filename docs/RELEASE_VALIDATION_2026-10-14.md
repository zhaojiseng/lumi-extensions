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

- [梦幻界面 1.1.10](https://github.com/zhaojiseng/lumi-extensions/releases/tag/extension.author.dreamy-v1.1.10) 已公开，发布时间为北京时间 2026-10-14 09:29:02。标签固定提交 `4c6c814a43fdace95bbb9c88df904b167ee0008e`，由干净 HEAD 打包后原子推送提交及标签，使用已有 GitHub CLI 账户创建、核验草稿并公开。
- 在 [Lumi 1.0.4](https://github.com/zhaojiseng/lumi/releases/tag/v1.0.4) 公开并完成六项附件核验后发布插件。宿主正式标签为 `8cd7184454f1180779c7cc82f3e9d4f2d1366fc5`，最终 [标签工作流](https://github.com/zhaojiseng/lumi/actions/runs/38494888745) 三平台检查、Windows x64/macOS ARM64 打包、隔离启动及包内核验全部成功。宿主发布排查只修复预览测试的媒体偏好和文档等待，保留本次插件 UI 回归使用的产品玻璃实现。
- ZIP 与 `.sha256` 两项公开附件完整。ZIP 为 21246 字节，SHA-256 `f7b4fe4c09e080f915b14b99010ad86c300b0f99a7781069e9af23e2bb4119fc`；校验文件自身 SHA-256 `444c44eea82f6eeffcd566baf69396b6424497c936a06fb6cbe347a9bbadaf68`。草稿与公开附件均重新下载，对照本地包、GitHub digest 和校验文本一致；ZIP 的 4 个文件与标签 Git 原始字节逐项相同。
- 本地验收证据为 `.cache/release-1110/{draft-verification.json,public-verification.json}` 及下载附件目录；均为忽略产物，不随插件分发。未修改其他插件或既有公开版本的标签和附件。
