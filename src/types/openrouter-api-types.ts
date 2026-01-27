/**
 * OpenRouter API types - locally defined to avoid external SDK dependency.
 * These types mirror the OpenRouter API specification.
 */

/**
 * Error structure returned by OpenRouter API.
 */
export type ChatErrorError = {
  code: string | number | null;
  message: string;
  param?: string | null | undefined;
  type?: string | null | undefined;
};

/**
 * Plugin identifier for web search functionality.
 */
export type IdWeb = 'web';

/**
 * Plugin identifier for file parsing functionality.
 */
export type IdFileParser = 'file-parser';

/**
 * Plugin identifier for content moderation.
 */
export type IdModeration = 'moderation';

/**
 * Search engine options for web search.
 * Open enum - accepts known values or any string for forward compatibility.
 */
export type Engine = 'native' | 'exa' | (string & {});

/**
 * PDF processing engine options.
 * Open enum - accepts known values or any string for forward compatibility.
 */
export type PdfEngine = 'mistral-ocr' | 'pdf-text' | 'native' | (string & {});

/**
 * Data collection preference for provider routing.
 * Open enum - accepts known values or any string for forward compatibility.
 */
export type DataCollection = 'deny' | 'allow' | (string & {});

/**
 * Model quantization levels for provider filtering.
 * Open enum - accepts known values or any string for forward compatibility.
 */
export type Quantization =
  | 'int4'
  | 'int8'
  | 'fp4'
  | 'fp6'
  | 'fp8'
  | 'fp16'
  | 'bf16'
  | 'fp32'
  | 'unknown'
  | (string & {});

/**
 * Provider sorting strategy options.
 * Open enum - accepts known values or any string for forward compatibility.
 */
export type ProviderSort = 'price' | 'throughput' | 'latency' | (string & {});
