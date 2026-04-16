import { z } from 'zod/v4';

export const VideoGenerationSubmitResponseSchema = z
  .object({
    id: z.string(),
    generation_id: z.string().optional(),
    polling_url: z.string(),
    status: z.string(),
  })
  .passthrough();

export type VideoGenerationSubmitResponse = z.infer<
  typeof VideoGenerationSubmitResponseSchema
>;

export const VideoGenerationPollResponseSchema = z
  .object({
    id: z.string(),
    generation_id: z.string().optional(),
    polling_url: z.string(),
    status: z.string(),
    unsigned_urls: z.array(z.string()).optional(),
    usage: z
      .object({
        cost: z.number().optional(),
        is_byok: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    error: z.string().optional(),
  })
  .passthrough();

export type VideoGenerationPollResponse = z.infer<
  typeof VideoGenerationPollResponseSchema
>;
