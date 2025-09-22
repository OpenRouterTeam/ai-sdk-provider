import { z } from 'zod/v4';

export const UrlCitationAnnotationSchema = z.object({
  type: z.literal('url_citation'),
  url_citation: z.object({
    end_index: z.number(),
    start_index: z.number(),
    title: z.string(),
    url: z.string(),
    content: z.string().optional(),
  }),
});

export const FileAnnotationSchema = z.object({
  type: z.literal('file'),
  file: z.object({
    hash: z.string(),
    name: z.string(),
    content: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
});

export const AnnotationUnionSchema = z.discriminatedUnion('type', [
  UrlCitationAnnotationSchema,
  FileAnnotationSchema,
]);

export type AnnotationUnion = z.infer<typeof AnnotationUnionSchema>;

export const AnnotationArraySchema = z.array(AnnotationUnionSchema);
