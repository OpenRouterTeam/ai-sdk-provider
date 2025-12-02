# GitHub Actions Utils

## Commands
- `pnpm test` - run all tests
- `pnpm test ActionUI` - run tests matching pattern
- `pnpm check` - typecheck

## Code Style
- **Runtime**: Bun, ES modules (`"type": "module"`)
- **Framework**: Effect-TS for all async/error handling
- **Imports**: Use `.js` extension for local imports (e.g., `./ActionUI.js`)
- **Types**: Prefer `readonly` arrays/properties; use `interface` for data shapes
- **Naming**: PascalCase for services/classes/types, camelCase for functions/variables
- **Services**: Define via `Effect.Service` or `Context.Tag`; provide `Default`/`Live` and `Mock` layers
- **Errors**: Use `Data.TaggedError` with `_tag` discriminant
- **Testing**: Use `@effect/vitest` with `it.effect()` for Effect-based tests
- **Exports**: Module exports via package.json `exports` field

## Patterns
- Wrap side effects in `Effect.sync()` or `Effect.tryPromise()`
- Use `Effect.gen(function* () { ... })` for sequential Effect composition
- Provide layers via `Effect.provide()` at entry points
- Use `Layer.mergeAll()` to combine multiple service layers

