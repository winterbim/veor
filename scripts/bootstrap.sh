#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$node_major" -lt 22 ]; then
  echo "VEOR requires Node.js >=22 (found: $(node -v 2>/dev/null || echo missing))" >&2
  exit 1
fi
mkdir -p .veor/output .veor/cursor-runtime
npm install --ignore-scripts
npm run check
node src/cli.js sandbox-info
cat <<'MSG'

VEOR handoff is ready.
Open CURSOR_HANDOFF.md first.
Cursor project MCP self-test config: .cursor/mcp.json
MSG
