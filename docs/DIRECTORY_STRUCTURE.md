# 目录结构与维护入口

本说明区分源码、当前安装包和历史交付副本。当前模型网关为 `1.0.0`，最低宿主为 Lumi `1.0.0`。

## 两个独立仓库

```text
E:\workspace\lumi\
├─ AGENTS.md                       工作区规则，位于两个仓库之外
├─ main\                           Lumi 主程序仓库（本地 public 分支）
│  ├─ electron\services\gateway-*   正式宿主服务与 Node 网关运行模块
│  ├─ native\gateway-runtime\       安装包实际编译的 Rust 核心
│  ├─ shared\contracts\gateway.ts   受限接口契约
│  ├─ extensions\sdk\               主程序维护的插件 SDK 类型
│  ├─ plugins\                      随主程序维护的内置插件
│  └─ release\                      主程序安装包、源码包和校验文件
└─ extensions\                     独立插件仓库（本地 main 分支）
   ├─ plugins\                     当前可直接安装的独立插件目录包
   ├─ sources\                     可选开发工程与隔离测试
   ├─ sdk\                         对应固定公开宿主的 SDK 类型
   ├─ scripts\                     仓库校验、开发回归与发布工具
   ├─ docs\                        设计、研究和验证记录
   ├─ host.json                     固定公开宿主版本和完整提交 SHA
   ├─ release\                     插件交付副本、ZIP 和 SHA-256
   └─ .cache\                      固定宿主、编译缓存、测试输出
```

`main/extensions` 是主程序内部目录；工作区的 `extensions` 是另一个 Git 仓库。独立网关插件不编译进 Lumi 安装包，但它依赖的特权服务和核心由匹配的 Lumi 构建提供。两个仓库分别修改、验证、提交和发布。

## 独立插件仓库的当前结构

```text
extensions\
├─ plugins\
│  ├─ extension.author.dreamy\
│  ├─ extension.lumi.codex\
│  ├─ extension.lumi.compact\
│  ├─ extension.lumi.notes\
│  └─ extension.lumi.gateway\          网关当前可安装包
│     ├─ plugin.json
│     ├─ index.html
│     ├─ app.js
│     ├─ style.css
│     ├─ README.md
│     └─ LICENSE
├─ sources\
│  ├─ extension.lumi.gateway\
│  │  ├─ package-stage\                网关页面的编辑源目录，同样七个文件
│  │  ├─ scripts\                      Chromium/Electron 界面回归驱动
│  │  └─ tests\                        页面、布局和交互断言
│  ├─ gateway-runtime\                 核心开发工程及隔离回归
│  │  ├─ src\                          Rust 开发源码
│  │  ├─ dev\                          Node 开发运行模块
│  │  ├─ tests\                        Rust/Node 与固定假上游测试
│  │  ├─ examples\                     测试核心夹具
│  │  └─ Cargo.toml / Cargo.lock
│  └─ gateway-host-bridge\
│     └─ README.md                     宿主接入说明；正式实现已在 main 中
└─ release\
   ├─ gateway-dense-ui-20261011\
   │  ├─ extension.lumi.gateway\       历史界面交付时冻结的资源副本
   │  └─ plugin-files-sha256.json       此交付副本的文件校验记录
   ├─ <其他交付批次>\                  当时版本的交付副本
   └─ <插件ID>-v<版本>.zip / .sha256    正式打包脚本的输出格式
```

`package-stage` 当前使用原生 HTML/CSS/JavaScript，没有另一个 React/TypeScript 编译步骤。它虽名为 stage，实际上也是网关页面的编辑入口；三个界面驱动都读取此目录。

## 哪一份该修改、安装或保留

| 内容 | 修改入口 | 输出或用途 |
| --- | --- | --- |
| 网关页面、插件清单及包内说明 | `sources/extension.lumi.gateway/package-stage/` | 验证后同步到 `plugins/extension.lumi.gateway/` |
| 网关页面测试 | `sources/extension.lumi.gateway/scripts/` 和 `tests/` | 输出写入 `.cache/` |
| 其他没有独立源码工程的插件 | 对应的 `plugins/<ID>/` | 该目录本身就是开发与安装入口 |
| 网关隔离核心/传输回归 | `sources/gateway-runtime/` | 供 `check:gateway` 使用，不随插件目录安装 |
| Lumi 实际运行的宿主服务和核心 | 相邻 `main` 仓库的 `electron/services`、`native/gateway-runtime` 等 | 随 Lumi 构建和安装包分发 |
| 已生成的交付副本、ZIP、校验清单 | `release/` | 保留对应交付时的字节，后续改动生成新批次 |

网关页面采用单向同步：

```text
sources/extension.lumi.gateway/package-stage
          │ 修改并运行界面回归
          ▼
plugins/extension.lumi.gateway
          │ 官方包校验、逐文件核对、从已提交版本打包
          ▼
release/<交付批次> 或 release/<插件ID>-v<版本>.zip
```

不要分别编辑网关的源目录和安装包目录，否则容易出现测试的是一份、安装的是另一份。正式打包前核对源目录与安装包目录七项资源一致；发布 ZIP 从已提交 HEAD 生成，并以 SHA-256 校验，历史 `release` 批次保留各自版本。安装时复制完整的 `plugins/extension.lumi.gateway`，不复制整个 `plugins`、`sources` 或 `package-stage` 的父目录。

`sources/gateway-runtime` 与主程序内置运行模块是两仓库中的独立文件。主程序构建不直接读取插件仓库的开发工程；运行逻辑改动需要分别核对、同步和验证。插件修复不自动授权修改主程序，确需改动时按工作区规则取得明确授权。`gateway-host-bridge` 不再存放待应用补丁。

## 校验与打包入口

全部插件使用 `host.json` 固定的 Lumi v1.0.0 官方校验器，例如在插件仓库运行：

```powershell
npm.cmd run setup:host
npm.cmd run check -- plugins/extension.lumi.notes
```

模型网关声明五项 `gateway.*` 权限和 `storage`，最低宿主为 Lumi 1.0.0。默认 `npm.cmd run check` 校验全部安装目录包，也可在匹配主程序仓库直接调用同一官方校验器：

```powershell
Set-Location E:\workspace\lumi\main
node --import tsx scripts/check-extensions.mjs ..\extensions\plugins\extension.lumi.gateway
```

页面回归在插件仓库运行，读取页面源目录；先构建匹配的主程序。真实集成默认使用该宿主 `dist-native` 中的固定核心，`--binary <绝对路径>` 可明确验证安装包内的同一核心；独立 `sources/gateway-runtime` 的开发运行时另行验证：

```powershell
Set-Location E:\workspace\lumi\extensions
node sources/extension.lumi.gateway/scripts/check-chromium-ui.mjs
node sources/extension.lumi.gateway/scripts/check-integration-ui.mjs ..\main
```

包校验不能替代真实界面、宿主或跨平台验证。正式发布前需先公开匹配的宿主，再更新固定宿主、SDK 和插件最低宿主版本。从已提交且干净的插件仓库 HEAD 执行 `npm.cmd run package -- <插件ID>`；该脚本读取 `plugins/<ID>/`，不读取 `package-stage` 或已有 `release` 副本。未提交修改和历史交付副本不作为正式发布包来源。

`.cache`、`release` 和开发依赖由 Git 忽略；源码、安装包目录中的运行资源、完整许可及维护文档纳入版本管理。安装位置在 Lumi 设置所打开的额外插件目录，与这里的开发仓库目录分开。
