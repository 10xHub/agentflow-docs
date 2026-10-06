import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { BLOG_KINDS, DOC_SECTIONS, type BlogKind } from './lib/site';

// Descriptions double as meta descriptions and as the summaries in llms.txt, so their
// length is enforced at build time (search engines show roughly 150-160 characters).
const description = z.string().min(50).max(170);

// Optional FAQ, rendered at the end of the page and as FAQPage JSON-LD from the same text,
// so the structured data always matches what readers see. Answers are plain text, 1-3 sentences.
// Optional <title> override, for when the H1 is too short or generic to rank. " | 10xGraph" is
// appended, so 49 characters keeps the full title within the ~60 that search results show.
const seoTitle = z.string().min(15).max(49).optional();

const faq = z.array(z.object({ q: z.string(), a: z.string() })).default([]);

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    seoTitle,
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
    seoTitle,
    description,
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    author: z.string(),
    /** One category per post; drives /blog/kind/<kind>. See BLOG_KINDS in lib/site.ts. */
    kind: z.enum(Object.keys(BLOG_KINDS) as [BlogKind, ...BlogKind[]]),
    tags: z.array(z.string()).default([]),
    /** Pin to the top of the blog index. */
    featured: z.boolean().default(false),
    faq,
    draft: z.boolean().default(false),
  }),
});

// Build guides: outcome-first, end-to-end builds shown at /build, ahead of the docs. Each one
// states its time, level and result up front, so a visitor can pick one in seconds.
const build = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/build' }),
  schema: z.object({
    title: z.string(),
    description,
    /** Honest time to finish, in minutes, for someone who has Python set up. */
    minutes: z.number().int().positive(),
    level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
    /** What the reader has at the end. Shown as a checklist on the card and the page. */
    outcome: z.array(z.string()).min(2).max(6),
    /** Package versions the guide was written and run against. */
    versions: z.string(),
    order: z.number().default(100),
    updated: z.coerce.date(),
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

export const collections = { docs, blog, build, releases };
