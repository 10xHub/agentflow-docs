// Blog authors, keyed by the `author` frontmatter value. Unknown authors still render, with no role.
export const AUTHORS: Record<string, { role: string }> = {
  'Shudipto Trafder': { role: 'Maintainer, 10xGraph' },
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
