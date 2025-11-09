---
title: "Sample Markdown Post"
date: "2025-11-09"
description: "Demonstration post showing the markdown to HTML build pipeline."
tags:
  - Demo
  - Markdown
  - Automation
---

# Building Posts with Markdown

Writing posts in markdown keeps the authoring experience fast and flexible.2

## Frontmatter Metadata

Every post includes metadata in YAML frontmatter at the top of the file. The build script uses this information for HTML `<meta>` tags and the on-page header.

- `title` controls the page title and heading.
- `date` displays under the post title.
- `description` feeds both SEO metadata and previews.
- `tags` populate the pill elements below the date.

## Formatting Content

You can use standard markdown syntax for headings, lists, code blocks, and more:

```js
function hello(name) {
  return `Hello, ${name}!`;
}
```

> Tip: Markdown lets you focus on writing, while the build step handles styling and layout.

