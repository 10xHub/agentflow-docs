import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { DOC_SECTIONS } from './lib/site';

// Descriptions double as meta descriptions and as the summaries in llms.txt, so their
// length is enforced at build time (search engines show roughly 150-160 characters).
const description = z.string().min(50).max(170);

// Optional FAQ, rendered at the end of the page and as FAQPage JSON-LD from the same text,
// so the structured data always matches what readers see. Answers are plain text, 1-3 sentences.
const faq = z.array(z.object({ q: z.string(), a: z.string() })).default([]);

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description,
    section: z.enum(DOC_SECTIONS),
    order: z.number().default(100),
    updated: z.coerce.date().optional(),
    faq,
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
    /** Pin to the top of the blog index. */
    featured: z.boolean().default(false),
    faq,
    draft: z.boolean().default(false),
  }),
});

export const collections = { docs, blog };
