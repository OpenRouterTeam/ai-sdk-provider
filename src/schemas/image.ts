import { z } from 'zod/v4';

const ImageResponseSchema = z.object({
  type: z.literal('image_url'),
  image_url: z.object({
    url: z.string(),
  }),
});

export type ImageResponse = z.infer<typeof ImageResponseSchema>;

const ImageResponseWithUnknownSchema = z.union([
  ImageResponseSchema,
  z.unknown().transform(() => null),
]);

export const ImageResponseArraySchema = z
  .array(ImageResponseWithUnknownSchema)
  .transform((d) => d.filter((d): d is ImageResponse => !!d));
