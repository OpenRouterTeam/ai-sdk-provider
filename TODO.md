# TODO

## Failing E2E Tests

### pdf-blob tests (`e2e/pdf-blob/index.test.ts`)

**Error:** `BadRequestResponseError: Invalid content` (400 from Anthropic)

**Likely causes:**
- The model `anthropic/claude-4.5-sonnet` may not exist - should probably be `anthropic/claude-sonnet-4` or similar
- PDF content may not be properly formatted for the API

### cache-control test (`e2e/cache-control.test.ts`)

**Error:** `expected 0 to be greater than 0` - cached tokens count is 0

**Known issue:** As documented in the test file comment (lines 9-17), the OpenRouter SDK (v0.1.27) strips the `cache_control` property from content items during Zod schema validation. The `ResponseInputText$outboundSchema` only includes `type` and `text` properties, so `cache_control` is discarded.

**Fix required:** Update the OpenRouter SDK to either:
- Add `cache_control` to the schema
- Use `.passthrough()` on the Zod schemas

## Test Configuration

### Environment Variables

Tests using `OPENROUTER_API_BASE` require it to be set (defaults not applied when explicitly using the env var in template strings). Files affected:
- `e2e/cache-control.test.ts`
- `e2e/reasoning-matrix.test.ts`
- `e2e/pdf-blob/index.test.ts`
- Several others use `baseUrl` (lowercase) which is ignored, falling back to defaults

### baseUrl vs baseURL typo

Several test files use `baseUrl` (lowercase 'r') instead of `baseURL` (uppercase 'R'). The provider interface only accepts `baseURL`, so the lowercase version is silently ignored and the default URL is used instead. Files to audit:
- `e2e/reasoning-effort.test.ts`
- `e2e/usage-accounting.test.ts`
- `e2e/tools-with-reasoning.test.ts`
- `e2e/stream-with-reasoning-and-tools.test.ts`
- `e2e/pdf-url/index.test.ts`
- `e2e/web-search/index.test.ts`
