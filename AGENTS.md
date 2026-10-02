# Repository Guidance

This repository contains independently distributed Lumi extensions. Primary documentation and UI are Chinese.

- Use Node.js 24+ and npm 11+. Run `npm ci --ignore-scripts`, `npm run setup:host`, then `npm run check`.
- `plugins/<id>/` contains install-ready packages, not development dependency trees. Optional build sources belong in `sources/<id>/`.
- Keep plugin IDs stable and bump each plugin's manifest version for release. Tags are `<id>-v<version>`.
- Reuse the official validator pinned in `host.json`. SDK runtime is supplied by Lumi; never bundle `lumi-sdk.js`.
- Preserve complete LICENSE and third-party notices in each package. Never commit credentials or user data.
- Package checks do not prove UI or desktop integration behavior. Validate changed UI and SDK behavior in the matching Lumi release.
- Do not modify the adjacent Lumi checkout as part of extension work unless explicitly requested.
