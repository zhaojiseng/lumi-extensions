# 供应商保存前获取模型：宿主接口方案

2026-10-11。插件 0.1.0-dev.13 与配套 Lumi 开发构建已实现保存前草稿模型目录查询。用户已明确允许本方案与热保存的宿主改动范围；本轮实际检查见 GATEWAY_VALIDATION.md。

## 用户操作

在“添加供应商”弹窗填写供应商 HTTPS Base URL、上游协议和 API Key 后，“自动获取模型”立即可用。点击后目录中的模型加入本次表单草稿，可改别名、启用与隐藏；最后统一保存供应商和模型。取消编辑会丢弃本次目录结果。创建供应商无需先保存、关闭弹窗再进入编辑。

## 为什么需要宿主改动

原有公开方法 `gateway.routes.models.detect` 的输入仅为 `{sessionId, expectedVersion, routeId}`。管理服务根据 `routeId` 查找已经存在的供应商及受保护的认证，未保存的供应商没有此引用。插件 CSP 为 `connect-src 'none'`，网络请求必须经过受限宿主接口。不能通过临时保存供应商伪装成草稿查询。

## 新增的受限操作

增加 `gateway.routes.models.preview`，权限复用 `gateway.config`；SDK 入口为 `gateway.routes.models.preview(input)`。

```ts
interface GatewayModelPreviewInput {
  sessionId: string;
  expectedVersion: number;
  routeId: string; // 本次表单 ID，用于关联返回结果，不要求已经存在
  protocol: 'openai' | 'anthropic';
  upstreamBase: string;
  upstreamApiKey: string;
}
```

输出复用 `GatewayModelCatalogDto`：`routeId`、`configVersion`、`source: 'catalog'`、实际检查时间、最多 500 个模型 ID，以及是否截断。本次凭据仅在查询的内存上下文中使用，不写配置、认证文件、插件 storage、请求记录或应用日志。查询不会创建临时供应商，也不启动、停止或修改数据监听。

## 具体改动范围

| 位置 | 改动 |
| --- | --- |
| main/shared/contracts/gateway.ts | 方法名、已有权限映射、严格输入和输出 DTO |
| main/shared/gateway-validation.ts | 输入校验：会话、版本、ID、协议、公共 HTTPS URL、ASCII Key；输出沿用有界目录校验 |
| main/public/lumi-extension-sdk.js | 固定方法入口；不暴露任意网络或 IPC |
| main/electron/services/gateway-management.ts | 会话及调用者作用域、受限远程调用和返回 ID/版本核对；凭据保持脱敏 |
| main/electron/services/gateway-runtime/management.mjs | 增加不写配置的目录预览分支，复用现有 catalog.mjs 的 HTTPS GET、公共 DNS 地址固定、TLS 校验与目录解析 |
| main/extensions/sdk/lumi-extension.d.ts、extensions/sdk/lumi-extension.d.ts | 同步方法类型，保持已有 detect 的输入和行为兼容 |
| extensions/sources/extension.lumi.gateway/package-stage/app.js | 按草稿或已保存来源选择 preview / detect，填写齐全即启用按钮；导入结果先留在表单 |
| 两仓库的相关回归及说明 | 记录本次实际验证结果，生成匹配宿主和插件的开发交付 |

目录预览继续遵守当前 12 秒超时、至多 2 个并发目录操作、总响应字节和分页上限、严格模型 ID、禁止重定向与凭据反射的既有规则。新请求只接收这次明确填写的 Key；修改 URL 或协议时不会把原已保存的 Key 自动发送到新地址。

## 异步和兼容行为

会话、页面上下文、查询序号、配置版本和草稿来源共同约束结果。修改 API/协议/Key、关闭或取消弹窗、重连、配置变化和离开页面均撤回迟到成功与错误。查询期间修改模型别名、启用或隐藏设置时，用最新表单列表合并，保留原设置。目录为空、认证失败、没有目录、网络失败和截断都明确反馈，并继续允许手动添加。

已有保存后的 detect 调用继续工作。旧配套宿主不提供 preview 时继续保留原目录读取能力，并明确显示保存前获取尚不可用；不能声称此模式已通过真实宿主验证。新方法需要更新配套 Lumi 开发构建和插件；新增权限为零，插件仍独立安装。

## 验证

使用假 Key、隔离应用/CLI 数据与本机 HTTPS 夹具检查 OpenAI 和 Anthropic 目录；确认新增供应商的 GET 发生在 routes.save 之前，查询前后配置、认证、监听和推理记录完全一致。覆盖输入拒绝、认证失败、目录缺失、空目录、分页截断、请求上限、反射凭据、草稿变更、关闭/重开、重连、主题与页面上下文、并发版本冲突，以及旧宿主回退。执行类型检查、对应 Node 回归与真实 Electron 页面回归后再交付。

## 与热保存的关系

供应商/密钥/端口的运行中保存属于已一并确认的 [热更新方案](GATEWAY_LIVE_CONFIGURATION.md)。草稿模型查询只读取目录；它不能代替解除热保存限制，也不能用验证目录 GET 的结果宣称已实现热保存。本轮分别验证查询不改变配置、热保存的版本事务、进行中请求快照、端口切换和失败回滚。
