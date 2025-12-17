# AI SDK v6 Migration Summary

## Key Changes from V2 to V3

### 1. Interface Name Changes
- `ProviderV2` → `ProviderV3`
- `LanguageModelV2` → `LanguageModelV3`
- `EmbeddingModelV2` → `EmbeddingModelV3`
- `LanguageModelV2CallWarning` → `SharedV3Warning`
- `SharedV2Headers` → `SharedV3Headers`
- `SharedV2ProviderMetadata` → `SharedV3ProviderMetadata`

### 2. Usage Structure Changed
V2 had flat structure:
```typescript
{
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
  reasoningTokens: number,
  cachedInputTokens: number
}
```

V3 has nested structure:
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

### 3. Warnings Field
- Now required (not optional) in return types
- Must be an array of `SharedV3Warning`

### 4. Specification Version
- Models must declare `specificationVersion = 'v3'` instead of `'v2'`

## Implementation Status

### Completed
- ✅ Updated package.json dependencies to v6 beta
- ✅ Updated provider.ts to use ProviderV3
- ✅ Updated chat model to use LanguageModelV3
- ✅ Updated completion model to use LanguageModelV3
- ✅ Updated embedding model to use EmbeddingModelV3
- ✅ Updated all type imports

### Remaining
- Update usage structures to match V3 format in:
  - chat/index.ts (doGenerate and doStream methods)
  - completion/index.ts (doGenerate and doStream methods)
- Fix test files to use v3 types
- Update conversion utils if needed
