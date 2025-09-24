import { z } from 'zod/v4';

const ImageResponseSchema = z.object({
  type: z.literal('image_url'),
  image_url: z.object({
    url: z.string(),
  }),
});

/**
 * Type for an image response from the OpenRouter API.
 */
export type ImageResponse = z.infer<typeof ImageResponseSchema>;

const ImageResponseWithUnknownSchema = z.union([
  ImageResponseSchema,
  z.unknown().transform(() => null),
]);

/**
 * Zod schema for an array of image responses from the OpenRouter API.
 * It filters out any unknown or invalid entries in the array.
 */
export const ImageResponseArraySchema = z
  .array(ImageResponseWithUnknownSchema)
  .transform((d) => d.filter((d): d is ImageResponse => !!d));
