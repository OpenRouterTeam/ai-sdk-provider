import { z } from 'zod/v4';

export const OpenRouterTranscriptionResponseSchema = z
  .object({
    text: z.string(),
    language: z.string().nullish(),
    duration: z.number().nullish(),
    segments: z
      .array(
        z
          .object({
            text: z.string(),
            start: z.number(),
            end: z.number(),
          })
          .passthrough(),
      )
      .nullish(),
    words: z
      .array(
        z
          .object({
            word: z.string(),
            start: z.number(),
            end: z.number(),
            type: z.string().nullish(),
            speaker: z.number().nullish(),
            speaker_label: z.string().nullish(),
          })
          .passthrough(),
      )
      .nullish(),
    usage: z
      .object({
        cost: z.number().nullish(),
        seconds: z.number().nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

export type OpenRouterTranscriptionResponse = z.infer<
  typeof OpenRouterTranscriptionResponseSchema
>;
