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
    /** Optional sub-group inside the section, e.g. "Python library" under Reference. */
    group: z.string().optional(),
    /** Shorter name for the docs map, when the title is long. */
    label: z.string().optional(),
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

// Release notes, one file per published version: src/content/releases/<package>-<version>.md.
// Versions and dates must match what PyPI / npm actually published.
const releases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/releases' }),
  schema: z.object({
    package: z.enum(['core', 'api', 'client']),
    version: z.string(),
    date: z.coerce.date(),
    summary: z.string().min(20).max(240),
    breaking: z.boolean().default(false),
  }),
});

export const collections = { docs, blog, releases };
