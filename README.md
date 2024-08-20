# OpenRouter Provider for Vercel AI SDK

The [OpenRouter](https://openrouter.ai/) provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs)
contains 160+ language model support for the OpenRouter chat and completion APIs.

## Setup

```bash
# For pnpm
pnpm add @openrouter/ai-sdk-provider

# For npm
npm install @openrouter/ai-sdk-provider

# For yarn
yarn add @openrouter/ai-sdk-provider
```

## Provider Instance

You can import the default provider instance `openrouter` from `@openrouter/ai-sdk-provider`:

```ts
import { openrouter } from "@openrouter/ai-sdk-provider";
```

## Example

```ts
import { openrouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const { text } = await generateText({
  model: openrouter("openai/gpt-4o"),
  prompt: "Write a vegetarian lasagna recipe for 4 people.",
});
```

## Supported models

This list is not a definitive list of models supported by OpenRouter, as it constantly changes as we add new models (and deprecate old ones) to our system.  
You can find the latest list of models supported by OpenRouter [here](https://openrouter.ai/models).

| Model                                         | ID                                          | Input Price ($/1M tokens) | Output Price ($/1M tokens) | Context Window | Moderation |
| --------------------------------------------- | ------------------------------------------- | ------------------------- | -------------------------- | -------------- | ---------- |
| Mistral: Mistral Nemo                         | mistralai/mistral-nemo                      | $0.3                      | $0.3                       | 128,000        | None       |
| Mistral: Codestral Mamba                      | mistralai/codestral-mamba                   | $0.25                     | $0.25                      | 256,000        | None       |
| OpenAI: GPT-4o-mini                           | openai/gpt-4o-mini                          | $0.15                     | $0.6                       | 128,000        | Moderated  |
| OpenAI: GPT-4o-mini (2024-07-18)              | openai/gpt-4o-mini-2024-07-18               | $0.15                     | $0.6                       | 128,000        | Moderated  |
| Qwen 2 7B Instruct                            | qwen/qwen-2-7b-instruct                     | $0.07                     | $0.07                      | 32,768         | None       |
| Google: Gemma 2 27B                           | google/gemma-2-27b-it                       | $0.27                     | $0.27                      | 8,192          | None       |
| Nous: Hermes 2 Theta 8B                       | nousresearch/hermes-2-theta-llama-3-8b      | $0.1875 (25% off)         | $1.125 (25% off)           | 16,384         | None       |
| Magnum 72B                                    | alpindale/magnum-72b                        | $3.75 (25% off)           | $4.5 (25% off)             | 16,384         | None       |
| Google: Gemma 2 9B                            | google/gemma-2-9b-it                        | $0.08                     | $0.08                      | 8,192          | None       |
| Google: Gemma 2 9B (free)                     | google/gemma-2-9b-it:free                   | $0 (100% off)             | $0 (100% off)              | 8,192          | None       |
| Llama 3 Stheno 8B v3.3 32K                    | sao10k/l3-stheno-8b                         | $0.25                     | $1.5                       | 32,000         | None       |
| Flavor of The Week                            | openrouter/flavor-of-the-week               | --                        | --                         | 32,000         | --         |
| Yi Large                                      | 01-ai/yi-large                              | $3                        | $3                         | 32,768         | None       |
| AI21: Jamba Instruct                          | ai21/jamba-instruct                         | $0.5                      | $0.7                       | 256,000        | None       |
| NVIDIA Nemotron-4 340B Instruct               | nvidia/nemotron-4-340b-instruct             | $4.2                      | $4.2                       | 4,096          | None       |
| Anthropic: Claude 3.5 Sonnet                  | anthropic/claude-3.5-sonnet                 | $3                        | $15                        | 200,000        | Moderated  |
| Anthropic: Claude 3.5 Sonnet (self-moderated) | anthropic/claude-3.5-sonnet:beta            | $3                        | $15                        | 200,000        | None       |
| Llama 3 Euryale 70B v2.1                      | sao10k/l3-euryale-70b                       | $1.48                     | $1.48                      | 8,192          | None       |
| Qwen 2 7B Instruct (free)                     | qwen/qwen-2-7b-instruct:free                | $0 (100% off)             | $0 (100% off)              | 32,768         | None       |
| Phi-3 Medium 4K Instruct                      | microsoft/phi-3-medium-4k-instruct          | $0.14                     | $0.14                      | 4,000          | None       |
| Dolphin 2.9.2 Mixtral 8x22B 🐬                | cognitivecomputations/dolphin-mixtral-8x22b | $0.9                      | $0.9                       | 65,536         | None       |
| Qwen 2 72B Instruct                           | qwen/qwen-2-72b-instruct                    | $0.56                     | $0.77                      | 32,768         | None       |
| OpenChat 3.6 8B                               | openchat/openchat-8b                        | $0.064                    | $0.064                     | 8,192          | None       |
| Mistral: Mistral 7B Instruct                  | mistralai/mistral-7b-instruct               | $0.06                     | $0.06                      | 32,768         | None       |
| Mistral: Mistral 7B Instruct v0.3             | mistralai/mistral-7b-instruct-v0.3          | $0.06                     | $0.06                      | 32,768         | None       |
| NousResearch: Hermes 2 Pro - Llama-3 8B       | nousresearch/hermes-2-pro-llama-3-8b        | $0.14                     | $0.14                      | 8,192          | None       |
| Phi-3 Mini 128K Instruct                      | microsoft/phi-3-mini-128k-instruct          | $0.1                      | $0.1                       | 128,000        | None       |
| Phi-3 Mini 128K Instruct (free)               | microsoft/phi-3-mini-128k-instruct:free     | $0 (100% off)             | $0 (100% off)              | 128,000        | None       |
| Phi-3 Medium 128K Instruct                    | microsoft/phi-3-medium-128k-instruct        | $1                        | $1                         | 128,000        | None       |
| Phi-3 Medium 128K Instruct (free)             | microsoft/phi-3-medium-128k-instruct:free   | $0 (100% off)             | $0 (100% off)              | 128,000        | None       |
| Llama 3 Lumimaid 70B                          | neversleep/llama-3-lumimaid-70b             | $3.375 (25% off)          | $4.5 (25% off)             | 8,192          | None       |
| Google: Gemini Flash 1.5                      | google/gemini-flash-1.5                     | $0.25                     | $0.75                      | 2,800,000      | None       |
| Perplexity: Llama3 Sonar 8B                   | perplexity/llama-3-sonar-small-32k-chat     | $0.2                      | $0.2                       | 32,768         | None       |
| Perplexity: Llama3 Sonar 8B Online            | perplexity/llama-3-sonar-small-32k-online   | $0.2                      | $0.2                       | 28,000         | None       |
| Perplexity: Llama3 Sonar 70B                  | perplexity/llama-3-sonar-large-32k-chat     | $1                        | $1                         | 32,768         | None       |
| Perplexity: Llama3 Sonar 70B Online           | perplexity/llama-3-sonar-large-32k-online   | $1                        | $1                         | 28,000         | None       |
| DeepSeek-V2 Chat                              | deepseek/deepseek-chat                      | $0.14                     | $0.28                      | 128,000        | None       |
| DeepSeek-Coder-V2                             | deepseek/deepseek-coder                     | $0.14                     | $0.28                      | 128,000        | None       |
| OpenAI: GPT-4o                                | openai/gpt-4o                               | $5                        | $15                        | 128,000        | Moderated  |
| OpenAI: GPT-4o (2024-05-13)                   | openai/gpt-4o-2024-05-13                    | $5                        | $15                        | 128,000        | Moderated  |
| Meta: Llama 3 8B (Base)                       | meta-llama/llama-3-8b                       | $0.18 (10% off)           | $0.18 (10% off)            | 8,192          | None       |
| Meta: Llama 3 70B (Base)                      | meta-llama/llama-3-70b                      | $0.81 (10% off)           | $0.81 (10% off)            | 8,192          | None       |
| Meta: LlamaGuard 2 8B                         | meta-llama/llama-guard-2-8b                 | $0.15                     | $0.15                      | 8,192          | None       |
| OLMo 7B Instruct                              | allenai/olmo-7b-instruct                    | $0.18 (10% off)           | $0.18 (10% off)            | 2,048          | None       |
| Qwen 1.5 110B Chat                            | qwen/qwen-110b-chat                         | $1.62 (10% off)           | $1.62 (10% off)            | 32,768         | None       |
| Qwen 1.5 72B Chat                             | qwen/qwen-72b-chat                          | $0.81 (10% off)           | $0.81 (10% off)            | 32,768         | None       |
| Qwen 1.5 32B Chat                             | qwen/qwen-32b-chat                          | $0.72 (10% off)           | $0.72 (10% off)            | 32,768         | None       |
| Qwen 1.5 14B Chat                             | qwen/qwen-14b-chat                          | $0.27 (10% off)           | $0.27 (10% off)            | 32,768         | None       |
| Qwen 1.5 7B Chat                              | qwen/qwen-7b-chat                           | $0.18 (10% off)           | $0.18 (10% off)            | 32,768         | None       |
| Qwen 1.5 4B Chat                              | qwen/qwen-4b-chat                           | $0.09 (10% off)           | $0.09 (10% off)            | 32,768         | None       |
| Meta: Llama 3 8B Instruct (free)              | meta-llama/llama-3-8b-instruct:free         | $0 (100% off)             | $0 (100% off)              | 8,192          | None       |
| Llama 3 Lumimaid 8B                           | neversleep/llama-3-lumimaid-8b              | $0.1875                   | $1.125                     | 24,576         | None       |
| Llama 3 Lumimaid 8B (extended)                | neversleep/llama-3-lumimaid-8b:extended     | $0.1875 (25% off)         | $1.125 (25% off)           | 24,576         | None       |
| Snowflake: Arctic Instruct                    | snowflake/snowflake-arctic-instruct         | $2.16 (10% off)           | $2.16 (10% off)            | 4,096          | None       |
| FireLLaVA 13B                                 | fireworks/firellava-13b                     | $0.2                      | $0.2                       | 4,096          | None       |
| Lynn: Llama 3 Soliloquy 8B v2                 | lynn/soliloquy-l3                           | $0.05                     | $0.05                      | 24,576         | None       |
| Fimbulvetr 11B v2                             | sao10k/fimbulvetr-11b-v2                    | $0.375 (25% off)          | $1.5 (25% off)             | 8,192          | None       |
| Meta: Llama 3 8B Instruct (extended)          | meta-llama/llama-3-8b-instruct:extended     | $0.1875 (25% off)         | $1.125 (25% off)           | 16,384         | None       |
| Meta: Llama 3 8B Instruct (nitro)             | meta-llama/llama-3-8b-instruct:nitro        | $0.18 (10% off)           | $0.18 (10% off)            | 8,192          | None       |
| Meta: Llama 3 70B Instruct (nitro)            | meta-llama/llama-3-70b-instruct:nitro       | $0.9                      | $0.9                       | 8,192          | None       |
| Meta: Llama 3 8B Instruct                     | meta-llama/llama-3-8b-instruct              | $0.06                     | $0.06                      | 8,192          | None       |
| Meta: Llama 3 70B Instruct                    | meta-llama/llama-3-70b-instruct             | $0.52                     | $0.75                      | 8,192          | None       |
| Mistral: Mixtral 8x22B Instruct               | mistralai/mixtral-8x22b-instruct            | $0.65                     | $0.65                      | 65,536         | None       |
| WizardLM-2 8x22B                              | microsoft/wizardlm-2-8x22b                  | $0.63                     | $0.63                      | 65,536         | None       |
| WizardLM-2 7B                                 | microsoft/wizardlm-2-7b                     | $0.07                     | $0.07                      | 32,000         | None       |
| Toppy M 7B (nitro)                            | undi95/toppy-m-7b:nitro                     | $0.07                     | $0.07                      | 4,096          | None       |
| Mistral: Mixtral 8x22B (base)                 | mistralai/mixtral-8x22b                     | $1.08 (10% off)           | $1.08 (10% off)            | 65,536         | None       |
| OpenAI: GPT-4 Turbo                           | openai/gpt-4-turbo                          | $10                       | $30                        | 128,000        | Moderated  |
| Google: Gemini Pro 1.5                        | google/gemini-pro-1.5                       | $2.5                      | $7.5                       | 2,800,000      | None       |
| Cohere: Command R+                            | cohere/command-r-plus                       | $3                        | $15                        | 128,000        | None       |
| Databricks: DBRX 132B Instruct                | databricks/dbrx-instruct                    | $1.08 (10% off)           | $1.08 (10% off)            | 32,768         | None       |
| Midnight Rose 70B                             | sophosympatheia/midnight-rose-70b           | $0.8                      | $0.8                       | 4,096          | None       |
| Cohere: Command                               | cohere/command                              | $1                        | $2                         | 4,096          | None       |
| Cohere: Command R                             | cohere/command-r                            | $0.5                      | $1.5                       | 128,000        | None       |
| Anthropic: Claude 3 Haiku                     | anthropic/claude-3-haiku                    | $0.25                     | $1.25                      | 200,000        | Moderated  |
| Anthropic: Claude 3 Haiku (self-moderated)    | anthropic/claude-3-haiku:beta               | $0.25                     | $1.25                      | 200,000        | None       |
| Google: Gemma 7B (nitro)                      | google/gemma-7b-it:nitro                    | $0.07                     | $0.07                      | 8,192          | None       |
| MythoMax 13B (nitro)                          | gryphe/mythomax-l2-13b:nitro                | $0.2                      | $0.2                       | 4,096          | None       |
| Anthropic: Claude 3 Opus                      | anthropic/claude-3-opus                     | $15                       | $75                        | 200,000        | Moderated  |
| Anthropic: Claude 3 Sonnet                    | anthropic/claude-3-sonnet                   | $3                        | $15                        | 200,000        | Moderated  |
| Anthropic: Claude 3 Opus (self-moderated)     | anthropic/claude-3-opus:beta                | $15                       | $75                        | 200,000        | None       |
| Anthropic: Claude 3 Sonnet (self-moderated)   | anthropic/claude-3-sonnet:beta              | $3                        | $15                        | 200,000        | None       |
| Mistral Large                                 | mistralai/mistral-large                     | $8                        | $24                        | 32,000         | None       |
| Google: Gemma 7B                              | google/gemma-7b-it                          | $0.07                     | $0.07                      | 8,192          | None       |
| Google: Gemma 7B (free)                       | google/gemma-7b-it:free                     | $0 (100% off)             | $0 (100% off)              | 8,192          | None       |
| Nous: Hermes 2 Mistral 7B DPO                 | nousresearch/nous-hermes-2-mistral-7b-dpo   | $0.18 (10% off)           | $0.18 (10% off)            | 8,192          | None       |
| Meta: CodeLlama 70B Instruct                  | meta-llama/codellama-70b-instruct           | $0.81 (10% off)           | $0.81 (10% off)            | 2,048          | None       |
| RWKV v5: Eagle 7B                             | recursal/eagle-7b                           | $0                        | $0                         | 10,000         | None       |
| OpenAI: GPT-3.5 Turbo (older v0613)           | openai/gpt-3.5-turbo-0613                   | $1                        | $2                         | 4,095          | Moderated  |
| OpenAI: GPT-4 Turbo Preview                   | openai/gpt-4-turbo-preview                  | $10                       | $30                        | 128,000        | Moderated  |
| ReMM SLERP 13B (extended)                     | undi95/remm-slerp-l2-13b:extended           | $1.125 (25% off)          | $1.125 (25% off)           | 6,144          | None       |
| Nous: Hermes 2 Mixtral 8x7B DPO               | nousresearch/nous-hermes-2-mixtral-8x7b-dpo | $0.45                     | $0.45                      | 32,768         | None       |
| Nous: Hermes 2 Mixtral 8x7B SFT               | nousresearch/nous-hermes-2-mixtral-8x7b-sft | $0.54 (10% off)           | $0.54 (10% off)            | 32,768         | None       |
| Mistral Tiny                                  | mistralai/mistral-tiny                      | $0.25                     | $0.25                      | 32,000         | None       |
| Mistral Small                                 | mistralai/mistral-small                     | $2                        | $6                         | 32,000         | None       |
| Mistral Medium                                | mistralai/mistral-medium                    | $2.7                      | $8.1                       | 32,000         | None       |
| Chronos Hermes 13B v2                         | austism/chronos-hermes-13b                  | $0.13                     | $0.13                      | 4,096          | None       |
| Noromaid Mixtral 8x7B Instruct                | neversleep/noromaid-mixtral-8x7b-instruct   | $8                        | $8                         | 8,000          | None       |
| Nous: Hermes 2 Yi 34B                         | nousresearch/nous-hermes-yi-34b             | $0.72 (10% off)           | $0.72 (10% off)            | 4,096          | None       |
| Mistral: Mistral 7B Instruct v0.2             | mistralai/mistral-7b-instruct-v0.2          | $0.06                     | $0.06                      | 32,768         | None       |
| Dolphin 2.6 Mixtral 8x7B 🐬                   | cognitivecomputations/dolphin-mixtral-8x7b  | $0.5                      | $0.5                       | 32,768         | None       |
| Google: Gemini Pro 1.0                        | google/gemini-pro                           | $0.125                    | $0.375                     | 91,728         | None       |
| Google: Gemini Pro Vision 1.0                 | google/gemini-pro-vision                    | $0.125                    | $0.375                     | 45,875         | None       |
| Mixtral 8x7B (base)                           | mistralai/mixtral-8x7b                      | $0.54 (10% off)           | $0.54 (10% off)            | 32,768         | None       |
| Mixtral 8x7B Instruct                         | mistralai/mixtral-8x7b-instruct             | $0.24                     | $0.24                      | 32,768         | None       |
| RWKV v5 World 3B                              | rwkv/rwkv-5-world-3b                        | $0                        | $0                         | 10,000         | None       |
| RWKV v5 3B AI Town                            | recursal/rwkv-5-3b-ai-town                  | $0                        | $0                         | 10,000         | None       |
| StripedHyena Nous 7B                          | togethercomputer/stripedhyena-nous-7b       | $0.18 (10% off)           | $0.18 (10% off)            | 32,768         | None       |
| StripedHyena Hessian 7B (base)                | togethercomputer/stripedhyena-hessian-7b    | $0.18 (10% off)           | $0.18 (10% off)            | 32,768         | None       |
| Psyfighter v2 13B                             | koboldai/psyfighter-13b-2                   | $1 (90% off)              | $1 (90% off)               | 4,096          | None       |
| Yi 34B Chat                                   | 01-ai/yi-34b-chat                           | $0.72 (10% off)           | $0.72 (10% off)            | 4,096          | None       |
| Yi 34B (base)                                 | 01-ai/yi-34b                                | $0.72 (10% off)           | $0.72 (10% off)            | 4,096          | None       |
| Yi 6B (base)                                  | 01-ai/yi-6b                                 | $0.18 (10% off)           | $0.18 (10% off)            | 4,096          | None       |
| MythoMist 7B                                  | gryphe/mythomist-7b                         | $0.375 (25% off)          | $0.375 (25% off)           | 32,768         | None       |
| Nous: Capybara 7B                             | nousresearch/nous-capybara-7b               | $0.18 (10% off)           | $0.18 (10% off)            | 8,192          | None       |
| Nous: Capybara 7B (free)                      | nousresearch/nous-capybara-7b:free          | $0 (100% off)             | $0 (100% off)              | 8,192          | None       |
| OpenChat 3.5 7B                               | openchat/openchat-7b                        | $0.07                     | $0.07                      | 8,192          | None       |
| OpenChat 3.5 7B (free)                        | openchat/openchat-7b:free                   | $0 (100% off)             | $0 (100% off)              | 8,192          | None       |
| Noromaid 20B                                  | neversleep/noromaid-20b                     | $1.5 (25% off)            | $2.25 (25% off)            | 8,192          | None       |
| MythoMist 7B (free)                           | gryphe/mythomist-7b:free                    | $0 (100% off)             | $0 (100% off)              | 32,768         | None       |
| Neural Chat 7B v3.1                           | intel/neural-chat-7b                        | $5 (50% off)              | $5 (50% off)               | 4,096          | None       |
| Anthropic: Claude v2                          | anthropic/claude-2                          | $8                        | $24                        | 200,000        | Moderated  |
| Anthropic: Claude v2.1                        | anthropic/claude-2.1                        | $8                        | $24                        | 200,000        | Moderated  |
| Anthropic: Claude Instant v1.1                | anthropic/claude-instant-1.1                | $0.8                      | $2.4                       | 100,000        | Moderated  |
| Anthropic: Claude v2 (self-moderated)         | anthropic/claude-2:beta                     | $8                        | $24                        | 200,000        | None       |
| Anthropic: Claude v2.1 (self-moderated)       | anthropic/claude-2.1:beta                   | $8                        | $24                        | 200,000        | None       |
| OpenHermes 2.5 Mistral 7B                     | teknium/openhermes-2.5-mistral-7b           | $0.17                     | $0.17                      | 4,096          | None       |
| OpenAI: GPT-4 Vision                          | openai/gpt-4-vision-preview                 | $10                       | $30                        | 128,000        | Moderated  |
| lzlv 70B                                      | lizpreciatior/lzlv-70b-fp16-hf              | $0.58                     | $0.78                      | 4,096          | None       |
| Toppy M 7B                                    | undi95/toppy-m-7b                           | $0.07                     | $0.07                      | 4,096          | None       |
| Goliath 120B                                  | alpindale/goliath-120b                      | $9.375 (25% off)          | $9.375 (25% off)           | 6,144          | None       |
| Toppy M 7B (free)                             | undi95/toppy-m-7b:free                      | $0 (100% off)             | $0 (100% off)              | 4,096          | None       |
| Auto (best for prompt)                        | openrouter/auto                             | --                        | --                         | 200,000        | --         |
| OpenAI: GPT-3.5 Turbo 16k (older v1106)       | openai/gpt-3.5-turbo-1106                   | $1                        | $2                         | 16,385         | Moderated  |
| OpenAI: GPT-4 Turbo (older v1106)             | openai/gpt-4-1106-preview                   | $10                       | $30                        | 128,000        | Moderated  |
| Hugging Face: Zephyr 7B (free)                | huggingfaceh4/zephyr-7b-beta:free           | $0 (100% off)             | $0 (100% off)              | 4,096          | None       |
| Google: PaLM 2 Chat 32k                       | google/palm-2-chat-bison-32k                | $0.25                     | $0.5                       | 91,750         | None       |
| Google: PaLM 2 Code Chat 32k                  | google/palm-2-codechat-bison-32k            | $0.25                     | $0.5                       | 91,750         | None       |
| OpenHermes 2 Mistral 7B                       | teknium/openhermes-2-mistral-7b             | $0.18 (10% off)           | $0.18 (10% off)            | 8,192          | None       |
| Mistral OpenOrca 7B                           | open-orca/mistral-7b-openorca               | $0.18 (10% off)           | $0.18 (10% off)            | 8,192          | None       |
| Airoboros 70B                                 | jondurbin/airoboros-l2-70b                  | $0.5                      | $0.5                       | 4,096          | None       |
| MythoMax 13B (extended)                       | gryphe/mythomax-l2-13b:extended             | $1.125 (25% off)          | $1.125 (25% off)           | 8,192          | None       |
| Xwin 70B                                      | xwin-lm/xwin-lm-70b                         | $3.75 (25% off)           | $3.75 (25% off)            | 8,192          | None       |
| OpenAI: GPT-3.5 Turbo Instruct                | openai/gpt-3.5-turbo-instruct               | $1.5                      | $2                         | 4,095          | Moderated  |
| Mistral: Mistral 7B Instruct v0.1             | mistralai/mistral-7b-instruct-v0.1          | $0.06                     | $0.06                      | 4,096          | None       |
| Mistral: Mistral 7B Instruct (free)           | mistralai/mistral-7b-instruct:free          | $0 (100% off)             | $0 (100% off)              | 32,768         | None       |
| Pygmalion: Mythalion 13B                      | pygmalionai/mythalion-13b                   | $1.125 (25% off)          | $1.125 (25% off)           | 8,192          | None       |
| OpenAI: GPT-3.5 Turbo 16k                     | openai/gpt-3.5-turbo-16k                    | $3                        | $4                         | 16,385         | Moderated  |

## Models with Tool Calling Capabilities Compatible with AI SDK

_Last Update: 2024-08-19_

This list is not a definitive list of tool-calling models supported by OpenRouter, as it constantly changes as we add new models (and deprecate old ones) to our system.
You can find the latest list of tool-supported models supported by OpenRouter [here](https://openrouter.ai/models?order=newest&supported_parameters=tools). (Note: This list may contain models that are not compatible with the AI SDK.)

- openai/gpt-3.5-turbo
- openai/gpt-3.5-turbo-0125
- openai/gpt-3.5-turbo-1106
- openai/gpt-3.5-turbo-0613
- openai/gpt-3.5-turbo-16k
- openai/gpt-4o
- openai/gpt-4o-2024-05-13
- openai/gpt-4o-2024-08-06
- openai/gpt-4o-mini
- openai/gpt-4o-mini-2024-07-18
- openai/gpt-4-turbo
- openai/gpt-4-turbo-preview
- openai/gpt-4-1106-preview
- openai/gpt-4
- openai/gpt-4-32k
- openai/gpt-4-vision-preview
- google/gemini-pro
- google/gemini-pro-vision
- google/gemini-pro-1.5
- google/gemini-flash-1.5
- mistralai/mistral-small
- mistralai/mistral-large
- 01-ai/yi-large-fc
- anthropic/claude-3-opus
- anthropic/claude-3-opus:beta
- anthropic/claude-3-sonnet
- anthropic/claude-3-sonnet:beta
- anthropic/claude-3.5-sonnet
- anthropic/claude-3.5-sonnet:beta
- anthropic/claude-3-haiku
- anthropic/claude-3-haiku:beta
- meta-llama/llama-3-8b-instruct
- mistralai/mixtral-8x22b-instruct

## Passing Extra Body to OpenRouter

When you want to pass extra body to OpenRouter or to the upstream provider, you can do so by setting the `extraBody` property on the language model.

```typescript
import { createOpenRouter } from "@ai-sdk/openrouter";

const provider = createOpenRouter({
  apiKey: "your-api-key",
  // Extra body to pass to OpenRouter
  extraBody: {
    custom_field: "custom_value",
    providers: {
      anthropic: {
        custom_field: "custom_value",
      },
    },
  },
});
const model = provider.chat("anthropic/claude-3.5-sonnet");
const response = await model.doStream({
  inputFormat: "prompt",
  mode: { type: "regular" },
  prompt: [{ role: "user", content: "Hello" }],
});
```
