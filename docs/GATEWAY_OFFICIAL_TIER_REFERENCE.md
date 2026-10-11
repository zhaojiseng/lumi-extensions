# OpenAI `service_tier` 官方协议核对

核对日期：**2026-10-10**。本记录依据实际下载的 OpenAI 官方 API 文档正文，不依据搜索摘要；未使用 API 密钥、真实账户或付费请求。它记录当日 OpenAI 协议，不作为第三方兼容站点的能力承诺。

## 来源与字段类型

| API | 已获取的官方页面 | 请求字段 | 返回对象字段 | 当日文档类型枚举 |
| --- | --- | --- | --- | --- |
| `POST /v1/responses` | [Create a response](https://developers.openai.com/api/reference/resources/responses/methods/create) | 可选 `ServiceTier` 或 `null` | 可选 `ServiceTier` 或 `null` | `auto`、`default`、`flex`、`scale`、`priority`、`fast`、`ultrafast` |
| `POST /v1/chat/completions` | [Create a chat completion](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) | 可选枚举字符串或 `null` | 可选枚举字符串或 `null` | `auto`、`default`、`flex`、`scale`、`priority`、`fast` |

表中的返回对象枚举来自各页面的返回类型定义。类型中列出某个值，不表示所有模型、项目、账户或兼容站点都可使用它，也不表示每个值都会出现在某一次实际响应中。两页均未说明显式 `null` 的处理规则，因此不将 `null` 与未设置或任意字符串等同。

## 请求与响应的区别

两页的字段说明均确认以下语义：

- 未设置该参数时，默认行为为 `auto`。
- `auto` 使用项目设置中的服务档位；项目未另行配置时使用 `default`。
- `default` 使用所选模型的标准定价和性能；`flex` 选择 Flex Processing。
- 请求 `fast` 或 `priority` 可在请求级选择 Fast mode。官方说明该情况下响应显示 `priority`。这是 OpenAI 文档描述的上游行为，网关保留发送值和响应值各自的原始观测，不执行 `fast` 与 `priority` 之间的自动转换。
- 响应中的 `service_tier` 表示**实际用于处理请求的模式**，可能与请求参数不同。原始值、规则修改后的发送值、上游报告值分别记录；不能用请求值补写缺失的响应值。

Responses 页面另外说明 `ultrafast` 是受访问控制的 Ultrafast Processing，当日页面注明可用于 `gpt-5.6-sol`，经此模式处理的响应显示 `ultrafast`。本次核对不证明任何本机账户获得了该访问权限，也不将这个说明扩展到 Chat Completions、其他模型或第三方站点。

两页将 `scale` 列在类型枚举中，但本次获取的字段说明没有给出其账户条件或具体运行语义；这里只记录它确实出现在枚举中。

## 网关使用边界

规则仍以实际上游路由能力为准。语法合法的自定义字符串不等于上游支持；官方枚举也不替代模型、项目权限和第三方接口的兼容性验证。本次没有核验具体限流、价格、吞吐、延迟保证、模型支持全集或账户可用性。

移除字段只删除 `service_tier`，不替换为字符串 `default`；未设置后的 `auto` 与显式 `default` 保持区别。`set-if-missing` 只处理真正缺失的字段，保留显式 `null`；空字符串或非字符串值也不冒充缺失。

流式观察依据实际终止事件读取上游报告字段。正文捕获达到容量上限不应阻断后续用量或档位观察；观察中断、无终止事件或响应缺失字段时保持未知，不虚构模式或用量。本记录没有把 OpenAI 的字段语义转换为网关的固定价格、固定模型列表或别名映射。

## 可复核的获取证据

两页均成功获取 **HTTP 200**，最终 URL 与上表链接一致。原始 HTML、提取文本和字段证据 JSON 保存在忽略的 `.cache/gateway-official-tier-reference/`，不进入插件目录包。

| 页面 | 原始 HTML 字节数 | SHA-256 |
| --- | ---: | --- |
| Responses Create | 11,951,349 | `0de91611ec986cba07700d454e2cf6878fd76ae218c65ccd8cc5ce4ca4c6a1da` |
| Chat Completions Create | 1,674,087 | `740887e32965b08c6851a13fe93cb92e14042d08f15298b08d11c0befa68efb7` |

官方页面后续可能更新；新增值、权限或模型范围应重新获取和核对，不以本记录冻结上游协议。
