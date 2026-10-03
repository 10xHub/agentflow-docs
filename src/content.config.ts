import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { DOC_SECTIONS } from './lib/site';

// Descriptions double as meta descriptions and as the summaries in llms.txt, so their
// length is enforced at build time (search engines show roughly 150-160 characters).
const description = z.string().min(50).max(170);

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description,
    section: z.enum(DOC_SECTIONS),
    order: z.number().default(100),
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description,
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    author: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { docs, blog };
