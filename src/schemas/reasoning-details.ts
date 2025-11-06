import { z } from 'zod/v4';
import { isDefinedOrNotNull } from '../utils/type-guards';
import { ReasoningFormat } from './format';

export enum ReasoningDetailType {
  Summary = 'reasoning.summary',
  Encrypted = 'reasoning.encrypted',
  Text = 'reasoning.text',
}

export const CommonReasoningDetailSchema = z.object({
  id: z.string().nullish(),
  format: z.nativeEnum(ReasoningFormat).nullish(),
  index: z.number().optional(),
});

export const ReasoningDetailSummarySchema = z
  .object({
    type: z.literal(ReasoningDetailType.Summary),
    summary: z.string(),
  })
  .extend(CommonReasoningDetailSchema.shape);
export type ReasoningDetailSummary = z.infer<typeof ReasoningDetailSummarySchema>;

export const ReasoningDetailEncryptedSchema = z
  .object({
    type: z.literal(ReasoningDetailType.Encrypted),
    data: z.string(),
  })
  .extend(CommonReasoningDetailSchema.shape);

export type ReasoningDetailEncrypted = z.infer<typeof ReasoningDetailEncryptedSchema>;

export const ReasoningDetailTextSchema = z
  .object({
    type: z.literal(ReasoningDetailType.Text),
    text: z.string().nullish(),
    signature: z.string().nullish(),
  })
  .extend(CommonReasoningDetailSchema.shape);

export type ReasoningDetailText = z.infer<typeof ReasoningDetailTextSchema>;

export const ReasoningDetailUnionSchema = z.union([
  ReasoningDetailSummarySchema,
  ReasoningDetailEncryptedSchema,
  ReasoningDetailTextSchema,
]);

export type ReasoningDetailUnion = z.infer<typeof ReasoningDetailUnionSchema>;

const ReasoningDetailsWithUnknownSchema = z.union([
  ReasoningDetailUnionSchema,
  z.unknown().transform(() => null),
]);

export const ReasoningDetailArraySchema = z
  .array(ReasoningDetailsWithUnknownSchema)
  .transform((d) => d.filter((d): d is ReasoningDetailUnion => !!d));

export const OutputUnionToReasoningDetailsSchema = z.union([
  z
    .object({
      delta: z.object({
        reasoning_details: z.array(ReasoningDetailsWithUnknownSchema),
      }),
    })
    .transform((data) => data.delta.reasoning_details.filter(isDefinedOrNotNull)),
  z
    .object({
      message: z.object({
        reasoning_details: z.array(ReasoningDetailsWithUnknownSchema),
      }),
    })
    .transform((data) => data.message.reasoning_details.filter(isDefinedOrNotNull)),
  z
    .object({
      text: z.string(),
      reasoning_details: z.array(ReasoningDetailsWithUnknownSchema),
    })
    .transform((data) => data.reasoning_details.filter(isDefinedOrNotNull)),
]);
