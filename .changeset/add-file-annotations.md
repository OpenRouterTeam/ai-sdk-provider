---
"@openrouter/ai-sdk-provider": minor
---

Add support for FileParser annotations to enable "Skip Parsing Costs" feature

- Annotations from file parsing are now exposed via `providerMetadata.openrouter.annotations`
- Pass annotations back via `providerOptions.openrouter.annotations` to skip re-parsing costs
- See https://openrouter.ai/docs/guides/overview/multimodal/pdfs#skip-parsing-costs
