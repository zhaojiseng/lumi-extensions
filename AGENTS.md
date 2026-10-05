# Repository Guidance

This repository contains independently distributed Lumi extensions. Primary documentation and UI are Chinese.

- Use Node.js 24+ and npm 11+. Run `npm ci --ignore-scripts`, `npm run setup:host`, then `npm run check`.
- `plugins/<id>/` contains install-ready packages, not development dependency trees. Optional build sources belong in `sources/<id>/`.
- Keep plugin IDs stable and bump each plugin's manifest version for release. Tags are `<id>-v<version>`.
- Reuse the official validator pinned in `host.json`. SDK runtime is supplied by Lumi; never bundle `lumi-sdk.js`.
- Preserve complete LICENSE and third-party notices in each package. Never commit credentials or user data.
- Package checks do not prove UI or desktop integration behavior. Validate changed UI and SDK behavior in the matching Lumi release.
- 插件开发优先使用现有接口在本仓库完成，能不修改主程序就不修改。若确实必须修改相邻 Lumi 主程序仓库，先向用户说明必要性、具体修改方案、范围及兼容影响，等待用户明确决定后再修改；不得先改动再补确认。插件开发、修复或发布请求本身不授权修改主程序。已有明确授权覆盖具体改动时，在授权范围内执行，无需重复确认。
- 提交 author/committer 和附注标签 tagger 使用当前仓库的 Git 默认身份，由 Git 按原有配置优先级解析 `user.name` 与 `user.email`，不固定姓名或邮箱。除非用户明确要求，不改写身份配置，不使用 `--author` 或身份环境变量覆盖默认账户。推送/发布使用 Git/GitHub CLI 已配置的用户账户，不使用 AI、机器人或服务账号，不添加 AI 账号的 `Co-authored-by` 联合署名。提交前通过 `git var GIT_AUTHOR_IDENT` 与 `git var GIT_COMMITTER_IDENT` 检查实际生效身份；默认身份缺失或为 AI 账号时先核实。
