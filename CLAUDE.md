# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenRouter Provider for Vercel AI SDK (`@openrouter/ai-sdk-provider`) - A TypeScript provider that integrates OpenRouter's API with the Vercel AI SDK, enabling access to 300+ language models through a unified interface.

## Common Commands

```bash
pnpm build              # Build with tsup (ESM + CJS outputs)
pnpm dev                # Watch mode development build
pnpm test               # Run all tests (node + edge environments)
pnpm test:node          # Run Node.js tests only
pnpm test:edge          # Run Edge runtime tests only
pnpm test:e2e           # Run E2E tests (requires OPENROUTER_API_KEY in .env.e2e)
pnpm typecheck          # TypeScript type checking
pnpm stylecheck         # Biome linting + formatting check
pnpm format             # Auto-fix formatting issues
pnpm changeset          # Create a changeset for release
```

### Running a Single Test

```bash
pnpm vitest run src/chat/index.test.ts              # Single test file (node)
pnpm vitest run src/chat/index.test.ts -t "test name"  # Specific test by name
```

## Architecture

### Source Structure

```
src/
├── provider.ts              # Factory: createOpenRouter() and default openrouter instance
├── facade.ts                # Deprecated OpenRouter class (legacy support)
├── chat/index.ts            # OpenRouterChatLanguageModel - main chat implementation
├── completion/index.ts      # OpenRouterCompletionLanguageModel - completions
├── embedding/index.ts       # OpenRouterEmbeddingModel - embeddings
├── types/                   # TypeScript interfaces for settings
├── schemas/                 # Zod schemas for request/response validation
└── internal/                # Conditional export: @openrouter/ai-sdk-provider/internal
```

### Key Patterns

- **Provider Factory**: `createOpenRouter(options)` returns a provider with `.chat()`, `.completion()`, and `.textEmbeddingModel()` methods
- **Message Conversion**: `convert-to-openrouter-chat-messages.ts` transforms AI SDK messages to OpenRouter format (handles images, files, cache control, tool results)
- **Dual Build Output**: tsup generates both main (`dist/`) and internal (`dist/internal/`) exports

### Test Environments

Tests run in three environments via separate Vitest configs:
- **Node.js** (`vitest.node.config.ts`) - Server-side tests
- **Edge Runtime** (`vitest.edge.config.ts`) - Serverless compatibility
- **E2E** (`vitest.e2e.config.ts`) - Real API integration (uses `.env.e2e`)

Test files are co-located with source: `src/chat/index.test.ts` tests `src/chat/index.ts`.

## Code Style

- Biome for linting/formatting (2 spaces, single quotes, 80 char line width)
- Tests may use explicit any and console (configured in biome.json overrides)
- Import organization: type imports first, then regular imports, then aliases

## Dev Workflow

### Before Starting Any Task
Always check the current state:
```bash
git status                    # Any uncommitted changes?
git branch                    # Which branch am I on?
```

**If there are uncommitted changes**: Either commit them, stash them (`git stash`), or discard them - never start new work with a dirty state.

**If on wrong branch**: Switch to main (`git checkout main && git pull`) before starting new work.

### After Completing Implementation
Automatically run this workflow - do not wait to be asked:

1. **Stage and review all changes**
   ```bash
   git add -A && git status
   ```
   Verify no unintended files (credentials, large binaries, etc.)

2. **Run full verification**
   ```bash
   pnpm stylecheck && pnpm typecheck && pnpm test && pnpm build
   ```
   If anything fails, fix it and re-run before proceeding.

3. **Commit, branch, and push**
   ```bash
   git commit -m "feat/fix/chore: description"
   git checkout -b claude/<feature-name>
   git push -u origin claude/<feature-name>
   ```

4. **Add changeset and push**
   ```bash
   pnpm changeset --empty  # or interactive: pnpm changeset
   git add .changeset && git commit -m "chore: add changeset" && git push
   ```

5. **Create PR and wait for CI**
   ```bash
   gh pr create --title "feat/fix/chore: description" --body "..."
   gh pr checks <PR_NUMBER> --watch
   ```
   If CI fails, fix issues, commit, push, and wait for CI again.

### Recovering from Issues

**Tests pass locally but CI fails**:
- Usually means uncommitted `package.json`/`pnpm-lock.yaml` changes
- Run `git status` to check, commit any missing files, push

**Need to fix something after PR is created**:
- Make fixes on the same branch
- `git add -A && git commit -m "fix: description" && git push`
- CI will re-run automatically

**Interrupted mid-workflow**:
- Run `git status` to see current state
- Either complete the workflow or `git stash` to save work for later
