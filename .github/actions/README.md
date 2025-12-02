# GitHub Actions Utils

TypeScript GitHub Actions using Effect-TS with local development support.

## Running Actions

```bash
# Local development (mock services)
pnpm --filter @openrouter-monorepo/github-action-utils act <action-name> [options]
pnpm --filter @openrouter-monorepo/github-action-utils act ui-demo --name "Developer"

# CI environment (real GitHub API)
pnpm --filter @openrouter-monorepo/github-action-utils act:ci <action-name> [options]
```

## Creating a New Action

1. Create `actions/<name>/action.ts` - see [actions/ui-demo/action.ts](actions/ui-demo/action.ts)
   - Use `Command.make()` from `@effect/cli`
   - Use `Options.withFallbackConfig()` for CI input compatibility
   - Access `ActionUI` and `GitHub` services via Effect

2. Create `actions/<name>/action.yaml` - see [actions/ui-demo/action.yaml](actions/ui-demo/action.yaml)
   - Define inputs/outputs
   - Use composite action that calls setup then runs your command

3. Register in [actions/index.ts](actions/index.ts)

## Services

- **ActionUI** ([lib/ActionUI.ts](lib/ActionUI.ts)) - GitHub workflow commands: annotations, groups, outputs, secrets
- **GitHub** ([lib/GitHub.ts](lib/GitHub.ts)) - GitHub API: event handling, PR operations, comments
- **Exec** ([lib/Exec.ts](lib/Exec.ts)) - Shell commands via template literals: `$`, `$lines`, `$sh`

## Entrypoints

- [bin/cli.ts](bin/cli.ts) - Local dev with some mock services
- [bin/ci.ts](bin/ci.ts) - CI with real services, reads `INPUT_*` env vars

## Testing

```bash
pnpm test              # Run all tests
pnpm test ActionUI     # Run tests matching pattern
pnpm check             # Typecheck
```
