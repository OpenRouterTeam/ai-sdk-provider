---
"@openrouter/ai-sdk-provider": patch
---

Add `engine` option to `web_search_options` for specifying search engine

Users can now specify which search engine to use for web search via `web_search_options.engine`:
- `"native"`: Use provider's built-in web search
- `"exa"`: Use Exa's search API  
- `undefined`: Native if supported, otherwise Exa

Thanks to @xdagiz for identifying this missing option in #182.
