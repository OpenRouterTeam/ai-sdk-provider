import { z } from 'zod/v4';

export enum ReasoningDetailType {
  Summary = 'reasoning.summary',
  Encrypted = 'reasoning.encrypted',
  Text = 'reasoning.text',
}

export enum ReasoningFormat {
  Unknown = 'unknown',
  OpenAIResponsesV1 = 'openai-responses-v1',
  XAIResponsesV1 = 'xai-responses-v1',
  AnthropicClaudeV1 = 'anthropic-claude-v1',
}

// Common fields for all reasoning detail types
const BaseReasoningDetailSchema = z.object({
  id: z.string().nullable(),
  format: z.nativeEnum(ReasoningFormat).default(ReasoningFormat.AnthropicClaudeV1),
  index: z.number().optional(),
});

export const ReasoningDetailSummarySchema = BaseReasoningDetailSchema.extend({
  type: z.literal(ReasoningDetailType.Summary),
  summary: z.string(),
});
export type ReasoningDetailSummary = z.infer<
  typeof ReasoningDetailSummarySchema
>;

export const ReasoningDetailEncryptedSchema = BaseReasoningDetailSchema.extend({
  type: z.literal(ReasoningDetailType.Encrypted),
  data: z.string(),
});
export type ReasoningDetailEncrypted = z.infer<
  typeof ReasoningDetailEncryptedSchema
>;

export const ReasoningDetailTextSchema = BaseReasoningDetailSchema.extend({
  type: z.literal(ReasoningDetailType.Text),
  text: z.string(),
  signature: z.string().nullable().optional(),
});

export type ReasoningDetailText = z.infer<typeof ReasoningDetailTextSchema>;

export const ReasoningDetailUnionSchema = z.union([
  ReasoningDetailSummarySchema,
  ReasoningDetailEncryptedSchema,
  ReasoningDetailTextSchema,
]);

const ReasoningDetailsWithUnknownSchema = z.union([
  ReasoningDetailUnionSchema,
  z.unknown().transform(() => null),
]);

export type ReasoningDetailUnion = z.infer<typeof ReasoningDetailUnionSchema>;

export const ReasoningDetailArraySchema = z
  .array(ReasoningDetailsWithUnknownSchema)
  .transform((d) => d.filter((d): d is ReasoningDetailUnion => !!d));
