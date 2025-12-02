# @openrouter-monorepo/github-action-utils

Effect-based framework for building GitHub Actions in TypeScript.

## Purpose

This package provides the core abstractions for defining and running GitHub Actions:

- **Action.make()** - Define an action with name and Effect-based run function
- **WorkflowRunner.run()** - Execute multiple actions concurrently

## Usage

```typescript
import { Action, WorkflowRunner } from "@openrouter-monorepo/github-action-utils"
import { Console, Effect } from "effect"

const MyAction = Action.make({
  name: "My Action",
  run: Effect.gen(function* () {
    yield* Console.log("Hello from my action!")
  })
})

WorkflowRunner.run([MyAction]).pipe(Effect.runPromise)
```

## Architecture

This package is intentionally minimal. It provides:

1. **Type-safe action definitions** - Actions are Effect programs with explicit error and dependency types
2. **Concurrent execution** - Multiple actions run in parallel with independent error handling
3. **GitHub integration** - (TODO) Services for GitHub API, Git operations, Slack notifications

## Future Services (not yet implemented)

- `GitHub` - High-level GitHub API (PR, Issue, Comment operations)
- `Shell` - Command execution

## Testing

Run locally with:
```bash
pnpm --filter @openrouter-monorepo/github-action-utils typecheck
```

## Development

This package is consumed by `@openrouter-monorepo/github-actions`. Changes here affect all actions.

---

# GitHub Workflows

## Running Workflows Locally

### Prerequisites

Install `act` (GitHub Actions local runner):
```bash
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | bash -s -- -b ~/.local/bin
```

Configure default image (one-time setup):
```bash
mkdir -p ~/.config/act
echo '-P ubuntu-latest=catthehacker/ubuntu:act-latest' > ~/.config/act/actrc
```

### Running TypeScript Actions

The TypeScript actions use a unified CLI with `@effect/cli`:

**Run actions directly (fastest, mock services)**:
```bash
# See all available actions and options
pnpm --filter @openrouter-monorepo/github-actions start --help

# Run hello action
pnpm --filter @openrouter-monorepo/github-actions start hello --name "Developer"

# Run llm-lint with dry-run (doesn't post comment)
pnpm --filter @openrouter-monorepo/github-actions start llm-lint --dry-run

# Run llm-lint with specific model
pnpm --filter @openrouter-monorepo/github-actions start llm-lint --model gpt-4 --dry-run

# See action-specific help
pnpm --filter @openrouter-monorepo/github-actions start llm-lint --help
```

**Simulate CI environment (with INPUT_* env vars)**:
```bash
INPUT_NAME="CI Test" pnpm --filter @openrouter-monorepo/github-actions start:ci hello
INPUT_MODEL="gpt-4" INPUT_DRY_RUN="true" pnpm --filter @openrouter-monorepo/github-actions start:ci llm-lint
```

### Running Full Workflow with act

**Dry run** (shows what would happen without executing):
```bash
act workflow_dispatch -W .github/workflows/ts-workflows.yaml --dryrun
```

**Full run** (executes in Docker, simulates real CI):
```bash
act workflow_dispatch -W .github/workflows/ts-workflows.yaml -j run-ts-actions
```

### Simulating Different Events

```bash
# Simulate pull_request event
act pull_request -W .github/workflows/ts-workflows.yaml

# Simulate push to main
act push -W .github/workflows/ts-workflows.yaml

# Simulate issue_comment
act issue_comment -W .github/workflows/ts-workflows.yaml
```

### Passing Secrets

Create a `.secrets` file (git-ignored):
```bash
GITHUB_TOKEN=$(gh auth token)
OPENROUTER_API_KEY=sk-or-xxxx
```

Then run with:
```bash
act workflow_dispatch -W .github/workflows/ts-workflows.yaml --secret-file .secrets
```

### Troubleshooting

**Docker not running**: `act` requires Docker. Start it with `systemctl start docker` or equivalent.

**Slow first run**: The first run downloads the runner image (~500MB for medium size).

**Permission errors**: Ensure your user is in the `docker` group: `sudo usermod -aG docker $USER`

## Architecture

See `packages/github-actions/AGENTS.md` for full documentation on:
- How to add new actions
- Service layer architecture
- Input schema definition with @effect/cli
