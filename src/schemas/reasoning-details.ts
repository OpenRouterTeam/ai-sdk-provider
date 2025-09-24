import { z } from 'zod/v4';

/**
 * Enum for the different types of reasoning details.
 */
export enum ReasoningDetailType {
  Summary = 'reasoning.summary',
  Encrypted = 'reasoning.encrypted',
  Text = 'reasoning.text',
}

/**
 * Zod schema for a summary reasoning detail.
 */
export const ReasoningDetailSummarySchema = z.object({
  type: z.literal(ReasoningDetailType.Summary),
  summary: z.string(),
});

/**
 * Type for a summary reasoning detail.
 */
export type ReasoningDetailSummary = z.infer<
  typeof ReasoningDetailSummarySchema
>;

/**
 * Zod schema for an encrypted reasoning detail.
 */
export const ReasoningDetailEncryptedSchema = z.object({
  type: z.literal(ReasoningDetailType.Encrypted),
  data: z.string(),
});

/**
 * Type for an encrypted reasoning detail.
 */
export type ReasoningDetailEncrypted = z.infer<
  typeof ReasoningDetailEncryptedSchema
>;

/**
 * Zod schema for a text reasoning detail.
 */
export const ReasoningDetailTextSchema = z.object({
  type: z.literal(ReasoningDetailType.Text),
  text: z.string().nullish(),
  signature: z.string().nullish(),
});

/**
 * Type for a text reasoning detail.
 */
export type ReasoningDetailText = z.infer<typeof ReasoningDetailTextSchema>;

/**
 * Zod schema for a union of all reasoning detail types.
 */
export const ReasoningDetailUnionSchema = z.union([
  ReasoningDetailSummarySchema,
  ReasoningDetailEncryptedSchema,
  ReasoningDetailTextSchema,
]);

const ReasoningDetailsWithUnknownSchema = z.union([
  ReasoningDetailUnionSchema,
  z.unknown().transform(() => null),
]);

/**
 * Type for a union of all reasoning detail types.
 */
export type ReasoningDetailUnion = z.infer<typeof ReasoningDetailUnionSchema>;

/**
 * Zod schema for an array of reasoning details.
 * It filters out any unknown or invalid entries in the array.
 */
export const ReasoningDetailArraySchema = z
  .array(ReasoningDetailsWithUnknownSchema)
  .transform((d) => d.filter((d): d is ReasoningDetailUnion => !!d));
