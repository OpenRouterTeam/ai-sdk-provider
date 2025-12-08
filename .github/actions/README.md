# GitHub Actions Utils

<!-- FIXME: This package is currently nested inside ai-sdk-provider but should
     be moved to its own location after discussing with the team. The nesting
     is a result of cherry-picking from the standalone ai-sdk-provider repo. -->

TypeScript GitHub Actions using Effect-TS with local development support.

## Running Actions

```bash
# Local development (mock services)
pnpm --filter @openrouter-monorepo/github-action-utils act <action-name> [options]
pnpm --filter @openrouter-monorepo/github-action-utils act example --name "Developer"

# CI environment (real GitHub API)
pnpm --filter @openrouter-monorepo/github-action-utils act:ci <action-name> [options]
```

## Creating a New Action

1. Create `actions/<name>/action.ts` - see [actions/example/action.ts](actions/example/action.ts)
   - Use `Command.make()` from `@effect/cli`
   - Use `Options.withFallbackConfig()` for CI input compatibility
   - Access `ActionUI` and `GitHub` services via Effect

2. Create `actions/<name>/action.yaml` - see [actions/example/action.yaml](actions/example/action.yaml)
   - Define inputs/outputs
   - Use composite action that calls setup then runs your command

3. Register in [actions/index.ts](actions/index.ts)

## Services

- **ActionUI** ([lib/action-ui.ts](lib/action-ui.ts)) - GitHub workflow commands: annotations, groups, outputs, secrets
- **GitHub** ([lib/github.ts](lib/github.ts)) - GitHub API: event handling, PR operations, comments
- **Exec** ([lib/exec.ts](lib/exec.ts)) - Shell commands via template literals: `$`, `$lines`, `$sh`

## Entrypoints

- [bin/cli.ts](bin/cli.ts) - Local dev with some mock services
- [bin/ci.ts](bin/ci.ts) - CI with real services, reads `INPUT_*` env vars

## Testing

```bash
pnpm test              # Run all tests
pnpm test ActionUI     # Run tests matching pattern
pnpm check             # Typecheck
```
