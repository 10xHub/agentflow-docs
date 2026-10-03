// Components available in every .mdx file without an import. Passed to <Content components={...} />.
// Each one also has a plain-markdown rendering in lib/content.ts (toMarkdown) for the .md twins.
import Callout from './Callout.astro';
import CardGrid from './CardGrid.astro';
import FileTree from './FileTree.astro';
import LinkCard from './LinkCard.astro';
import Steps from './Steps.astro';
import TabItem from './TabItem.astro';
import Tabs from './Tabs.astro';

export const mdxComponents = { Callout, CardGrid, FileTree, LinkCard, Steps, TabItem, Tabs };
