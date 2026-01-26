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

## PR Requirements

1. Run `pnpm stylecheck && pnpm typecheck && pnpm test && pnpm build`
2. Add changeset: `pnpm changeset` (or `pnpm changeset --empty` for non-release changes)
3. PR titles: `fix:`, `feat:`, `docs:`, `test:`, `chore:` prefixes
4. Branch naming: Use `claude/` prefix for branches (e.g., `claude/fix-reasoning-duplicates`)
