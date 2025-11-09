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

### Metadata Fields

Dig a little deeper into what each field is doing for the final HTML output.

#### Title

Controls both the on-page `<h1>` and the `<title>` tag that appears in the browser.

#### Description

Populates meta descriptions for search and the Open Graph preview shown on social platforms.

## Formatting Content

You can use standard markdown syntax for headings, lists, code blocks, and more:

```js
function hello(name) {
  return `Hello, ${name}!`;
}
```

> Tip: Markdown lets you focus on writing, while the build step handles styling and layout.

### Publishing Workflow

Once you're happy with the content, the rest of the workflow is automated.

#### Local Build

Run `npm run build` to confirm the output matches expectations before committing.

#### Pre-commit Hook

The Husky hook regenerates HTML from markdown on every commit.

##### Extra Checks

Add linting or screenshot tests here if you want to enforce additional quality gates.

### Inline Code Blocks

Need to drop a quick shell command? Wrap it with triple backticks on one line like this:
```npm run build```
The generator will format it as a fenced code block automatically.
