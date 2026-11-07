#!/usr/bin/env bash
# Typechecks a small consumer of the built package against the latest
# published `ai` release, without touching the pinned devDependency.
# Run `pnpm build` first. Usage: compat/ai-latest/check.sh [ai-version]
set -euo pipefail

AI_VERSION="${1:-latest}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pnpm --dir "$ROOT" pack --pack-destination "$WORK" >/dev/null
cp "$ROOT/compat/ai-latest/consumer.ts" "$ROOT/compat/ai-latest/tsconfig.json" "$WORK/"

cd "$WORK"
cat > package.json <<'EOF'
{ "name": "ai-latest-compat", "private": true, "type": "module" }
EOF
npm install --no-audit --no-fund --no-save \
  "ai@$AI_VERSION" zod typescript@5.9.2 @types/node@24 \
  ./openrouter-ai-sdk-provider-*.tgz

echo "Typechecking against ai@$(node -p "require('ai/package.json').version")"
npx tsc -p tsconfig.json
