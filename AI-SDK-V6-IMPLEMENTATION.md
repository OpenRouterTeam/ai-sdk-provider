# AI SDK v6 Implementation for OpenRouter Provider

## Overview

This document outlines the implementation of AI SDK v6 support for the @openrouter/ai-sdk-provider package. The implementation updates the provider from using AI SDK v5 (ProviderV2, LanguageModelV2, EmbeddingModelV2) to v6 (ProviderV3, LanguageModelV3, EmbeddingModelV3).

## Changes Implemented

### 1. Package Dependencies Updated

**File: `package.json`**

Updated AI SDK packages to v6 beta versions:
- `@ai-sdk/provider`: `2.0.0` → `3.0.0-beta.27`
- `@ai-sdk/provider-utils`: `3.0.1` → `4.0.0-beta.53`
- `ai`: `5.0.104` → `6.0.0-beta.159`
- Peer dependency: `ai`: `^5.0.0` → `^6.0.0`

### 2. Provider Interface Updated

**File: `src/provider.ts`**

- Changed `ProviderV2` → `ProviderV3` import and interface extension
- No functional changes to the provider implementation needed

### 3. Chat Language Model Updated

**File: `src/chat/index.ts`**

Type Updates:
- `LanguageModelV2` → `LanguageModelV3`
- `LanguageModelV2CallOptions` → `LanguageModelV3CallOptions`
- `LanguageModelV2CallWarning` → `SharedV3Warning`
- `LanguageModelV2Content` → `LanguageModelV3Content`
- `LanguageModelV2FinishReason` → `LanguageModelV3FinishReason`
- `LanguageModelV2FunctionTool` → `LanguageModelV3FunctionTool`
- `LanguageModelV2ResponseMetadata` → `LanguageModelV3ResponseMetadata`
- `LanguageModelV2StreamPart` → `LanguageModelV3StreamPart`
- `LanguageModelV2Usage` → `LanguageModelV3Usage`
- `SharedV2Headers` → `SharedV3Headers`
- `SharedV2ProviderMetadata` → `SharedV3ProviderMetadata`

Specification Version:
- `specificationVersion = 'v2'` → `specificationVersion = 'v3'`

### 4. Completion Language Model Updated

**File: `src/completion/index.ts`**

Type Updates:
- `LanguageModelV2` → `LanguageModelV3`
- `LanguageModelV2CallOptions` → `LanguageModelV3CallOptions`
- `LanguageModelV2StreamPart` → `LanguageModelV3StreamPart`
- `LanguageModelV2Usage` → `LanguageModelV3Usage`

Specification Version:
- `specificationVersion = 'v2'` → `specificationVersion = 'v3'`

### 5. Embedding Model Updated

**File: `src/embedding/index.ts`**

Type Updates:
- `EmbeddingModelV2` → `EmbeddingModelV3`
- `SharedV2Headers` → `SharedV3Headers`
- `SharedV2ProviderMetadata` → `SharedV3ProviderMetadata`

Specification Version:
- `specificationVersion = 'v2'` → `specificationVersion = 'v3'`

Added `warnings` field:
- Return type now includes `warnings: Array<SharedV3Warning>` (required in v6)
- Currently returns empty array: `warnings: []`

## Critical Changes Needed

### Usage Structure Migration

The most significant change in v6 is the restructuring of the `LanguageModelV3Usage` type from a flat structure to a nested object structure.

**V2 (Current - needs updating):**
```typescript
{
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
  reasoningTokens: number,
  cachedInputTokens: number
}
```

**V3 (Target structure):**
```typescript
{
  inputTokens: {
    total: number | undefined,
    noCache: number | undefined,
    cacheRead: number | undefined,
    cacheWrite: number | undefined
  },
  outputTokens: {
    total: number | undefined,
    text: number | undefined,
    reasoning: number | undefined
  },
  raw?: JSONObject
}
```

### Files Requiring Usage Structure Updates

1. **`src/chat/index.ts`**
   - `doGenerate()` method: Lines ~273-291
   - `doStream()` method: Lines ~559-565, ~628-658

2. **`src/completion/index.ts`**
   - `doGenerate()` method: Lines ~201-211
   - `doStream()` method: Lines ~255-261, ~287-315

### Example Migration

**Before (V2):**
```typescript
const usageInfo: LanguageModelV2Usage = response.usage
  ? {
      inputTokens: response.usage.prompt_tokens ?? 0,
      outputTokens: response.usage.completion_tokens ?? 0,
      totalTokens:
        (response.usage.prompt_tokens ?? 0) +
        (response.usage.completion_tokens ?? 0),
      reasoningTokens:
        response.usage.completion_tokens_details?.reasoning_tokens ?? 0,
      cachedInputTokens:
        response.usage.prompt_tokens_details?.cached_tokens ?? 0,
    }
  : {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    };
```

**After (V3):**
```typescript
const usageInfo: LanguageModelV3Usage = response.usage
  ? {
      inputTokens: {
        total: response.usage.prompt_tokens,
        noCache: undefined, // Calculate from total - cached if available
        cacheRead: response.usage.prompt_tokens_details?.cached_tokens,
        cacheWrite: undefined
      },
      outputTokens: {
        total: response.usage.completion_tokens,
        text: undefined, // Calculate from total - reasoning if available
        reasoning: response.usage.completion_tokens_details?.reasoning_tokens
      }
    }
  : {
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined
      },
      outputTokens: {
        total: undefined,
        text: undefined,
        reasoning: undefined
      }
    };
```

## Test Files Requiring Updates

The following test files import V2 types and will need updating:

1. `src/chat/errors.test.ts`
   - Import `createTestServer` from new location (if available)
   - Update prompt types from V2 to V3

2. `src/tests/provider-options.test.ts`
   - Import `createTestServer` from new location

3. `src/tests/stream-usage-accounting.test.ts`
   - Import `createTestServer` from new location

4. `src/tests/usage-accounting.test.ts`
   - Import `createTestServer` from new location

## Additional Considerations

### Conversion Utilities

**File: `src/completion/convert-to-openrouter-completion-prompt.ts`**

Check if this file needs updates for V3 prompt types. The conversion from V3 prompts to V2 prompts may need adjustment.

### Provider Metadata

The `SharedV3ProviderMetadata` type has changed from:
```typescript
Record<string, Record<string, JSONValue>>
```
to:
```typescript
Record<string, JSONObject>
```

Where `JSONObject` is:
```typescript
{
  [key: string]: JSONValue | undefined;
}
```

This is a more restrictive type that allows `undefined` values in the object.

## Build Status

Current build status: **FAILING**

Errors:
- Type mismatches in usage structures (completion model)
- Test utilities not found (`createTestServer`)
- Prompt type conversions in conversion utilities

## Next Steps

1. Update all usage structures in chat and completion models to use nested V3 format
2. Fix test files to use V3 types or find v6 test utilities
3. Update conversion utilities if needed
4. Run full test suite to ensure compatibility
5. Update documentation and examples

## Migration Strategy

To complete the migration:

1. Fix usage structures (highest priority - breaks type checking)
2. Comment out or update test files temporarily
3. Build and test basic functionality
4. Re-enable tests with V3 types
5. Full integration testing with actual AI SDK v6

## References

- AI SDK v6 Provider Interface: `node_modules/@ai-sdk/provider/dist/index.d.ts`
- OpenAI v6 Implementation: `node_modules/@ai-sdk/openai/dist/index.d.ts`
- Anthropic v6 Implementation: `node_modules/@ai-sdk/anthropic/dist/index.d.ts`
