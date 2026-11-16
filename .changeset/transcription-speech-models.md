---
'@openrouter/ai-sdk-provider': minor
---

Add `transcriptionModel(modelId, settings?)` and `speechModel(modelId, settings?)` to the provider. They call the OpenRouter `/audio/transcriptions` and `/audio/speech` endpoints and work with the AI SDK `transcribe()` and `generateSpeech()` functions. Transcription supports word and segment timestamps (`verbose_json`), `language`, `diarize`, `keyterms` and other provider options via `providerOptions.openrouter`.
