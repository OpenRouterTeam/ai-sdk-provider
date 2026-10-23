/**
 * Cheap, live model defaults (verified against the public
 * https://openrouter.ai/api/v1/models catalog and /endpoints on 2026-10-23).
 * Every slug can be overridden with the env var named next to it.
 * Prices are USD per 1M input / output tokens at verification time.
 */
const env = (name: string, fallback: string) => process.env[name] || fallback;

export const MODELS = {
  /** $0.10 / $0.50. Tools, reasoning (efforts incl. `max`), cache_control. */
  anthropic: env('PROBE_ANTHROPIC_MODEL', 'anthropic/claude-haiku-5.5'),
  /**
   * $2 / $10. Claude 5.5 family emits separately signed "progress" thinking
   * blocks between tool calls (#582/#583). Only used by the #583 probe.
   */
  anthropicThinking: env(
    'PROBE_ANTHROPIC_THINKING_MODEL',
    'anthropic/claude-sonnet-5.5',
  ),
  /** $0.05 / $0.40. Mandatory reasoning, returns encrypted reasoning. */
  openaiReasoning: env('PROBE_OPENAI_REASONING_MODEL', 'openai/gpt-5-nano'),
  /** $0.20 / $1.20. The model from the #542 report ("gpt luna"). */
  openaiLuna: env('PROBE_OPENAI_LUNA_MODEL', 'openai/gpt-5.6-luna'),
  /** $0.091 / $0.182. Reasoning + tools. Target model in #542. */
  deepseek: env('PROBE_DEEPSEEK_MODEL', 'deepseek/deepseek-v4-flash'),
  /** $0.10 / $0.40. Vision (image detail), strict tools, two providers. */
  openaiCheap: env('PROBE_OPENAI_CHEAP_MODEL', 'openai/gpt-4.1-nano'),
  /** $0.10 / $0.40. Video input (YouTube URLs via AI Studio). */
  geminiVideo: env('PROBE_GEMINI_VIDEO_MODEL', 'google/gemini-2.5-flash-lite'),
  /** $0.25 / $1.50. Gemini 3 video model for `video_url.processing`. */
  geminiVideoProcessing: env(
    'PROBE_GEMINI_VIDEO_PROCESSING_MODEL',
    'google/gemini-3.1-flash-lite',
  ),
  /** Rerank model (per-search pricing, not listed in the catalog). */
  rerank: env('PROBE_RERANK_MODEL', 'cohere/rerank-v3.5'),
  /** $0.042 / 1M input. Decisions API model. */
  decision: env('PROBE_DECISION_MODEL', 'typesafe/jev-1.14'),
} as const;

/** Provider slugs for the #605 routing probe (both serve `openaiCheap`). */
export const ROUTING = {
  configuredOrder: env('PROBE_ROUTING_ORDER', 'azure'),
  other: env('PROBE_ROUTING_OTHER', 'openai'),
} as const;

/** Small public assets. */
export const ASSETS = {
  /** 2560x1280 PNG from this repo, pinned to a commit. */
  imageUrl: env(
    'PROBE_IMAGE_URL',
    'https://raw.githubusercontent.com/OpenRouterTeam/ai-sdk-provider/1b22b05352cb0f9243a6c3fdd326038dd3705544/assets/banner.png',
  ),
  /** "Me at the zoo", 19 s. Gemini on AI Studio only accepts YouTube URLs. */
  videoUrl: env(
    'PROBE_VIDEO_URL',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  ),
} as const;

export const SKIP_VIDEO = process.env.SKIP_VIDEO === '1';
