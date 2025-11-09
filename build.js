const path = require("path");
const fs = require("fs-extra");
const matter = require("gray-matter");
const { marked } = require("marked");

const ROOT_URL = "https://blog.taitranz.com";
const SOURCE_DIR = path.join(__dirname, "posts", "markdown");
const OUTPUT_DIR = path.join(__dirname, "posts");
const TEMPLATE_PATH = path.join(__dirname, "posts", "template.html");

marked.setOptions({
    gfm: true,
    breaks: false,
    headerIds: true,
    mangle: false,
});

/**
 * Convert markdown posts to HTML using the shared template.
 */
async function buildPosts() {
    const [template, files] = await Promise.all([
        readTemplate(),
        readMarkdownFiles(),
    ]);

    if (files.length === 0) {
        console.log("No markdown files found in posts/markdown. Skipping build.");
        return;
    }

    await fs.ensureDir(OUTPUT_DIR);

    for (const file of files) {
        const markdownPath = path.join(SOURCE_DIR, file);
        const { data, content } = matter(await fs.readFile(markdownPath, "utf8"));

        try {
            validateFrontmatter(file, data);
        } catch (error) {
            console.warn(`Skipping ${file}: ${error.message}`);
            continue;
        }

        const slug = data.slug || file.replace(/\.md$/i, "");
        const urlFromFrontmatter = typeof data.url === "string" ? data.url.trim() : "";
        const canonicalUrl = urlFromFrontmatter || `${ROOT_URL}/posts/${slug}.html`;

        const { html: htmlContent, tocHtml } = renderMarkdownWithToc(content);

        const rendered = fillTemplate(template, {
            title: escapeHtml(data.title),
            description: escapeHtml(data.description || ""),
            keywords: buildKeywords(data),
            url: canonicalUrl,
            date: escapeHtml(data.date || ""),
            tags: buildTagsHtml(data.tags),
            toc: tocHtml,
            content: htmlContent,
        });

        const outputPath = path.join(OUTPUT_DIR, `${slug}.html`);
        await fs.writeFile(outputPath, rendered.trim() + "\n", "utf8");

        console.log(`✓ Built ${outputPath}`);
    }
}

/**
 * Ensure the template exists and return its contents.
 */
async function readTemplate() {
    const exists = await fs.pathExists(TEMPLATE_PATH);
    if (!exists) {
        throw new Error(`Template file not found at ${path.relative(process.cwd(), TEMPLATE_PATH)}`);
    }

    return fs.readFile(TEMPLATE_PATH, "utf8");
}

/**
 * Return a list of markdown files in the source directory.
 */
async function readMarkdownFiles() {
    const exists = await fs.pathExists(SOURCE_DIR);
    if (!exists) {
        return [];
    }

    const allFiles = await fs.readdir(SOURCE_DIR);
    return allFiles.filter((file) => file.toLowerCase().endsWith(".md"));
}

/**
 * Validate required frontmatter fields.
 */
function validateFrontmatter(filename, data) {
    const required = ["title", "date", "description"];
    const missing = required.filter((key) => !data[key]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required frontmatter (${missing.join(", ")}) in ${path.join("posts", "markdown", filename)}`
        );
    }

    if (data.tags && !Array.isArray(data.tags)) {
        throw new Error(`Expected 'tags' to be an array in ${path.join("posts", "markdown", filename)}`);
    }
}

/**
 * Build a comma-separated keywords string from frontmatter.
 */
function buildKeywords(data) {
    if (Array.isArray(data.keywords)) {
        return escapeHtml(data.keywords.join(", "));
    }

    if (typeof data.keywords === "string") {
        return escapeHtml(data.keywords);
    }

    if (Array.isArray(data.tags)) {
        return escapeHtml(data.tags.join(", "));
    }

    return "";
}

/**
 * Render tags into HTML blocks.
 */
function buildTagsHtml(tags) {
    if (!Array.isArray(tags) || tags.length === 0) {
        return "";
    }

    return tags
        .map((tag) => tag && String(tag).trim())
        .filter(Boolean)
        .map((tag) => `                            <div class="tag">\n                                ${escapeHtml(tag)}\n                            </div>`)
        .join("\n");
}

/**
 * Render markdown to HTML while generating a table of contents.
 */
function renderMarkdownWithToc(markdown) {
    const headings = [];
    const renderer = new marked.Renderer();
    const slugCounts = new Map();

    renderer.heading = function ({ tokens, depth }) {
        const renderedText = this.parser.parseInline(tokens);
        const baseSlug = slugify(stripHtml(renderedText));
        const count = slugCounts.get(baseSlug) || 0;
        slugCounts.set(baseSlug, count + 1);
        const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;

        if (depth >= 2 && depth <= 6) {
            headings.push({
                level: depth,
                text: stripHtml(renderedText),
                slug,
            });
        }
        return `<h${depth} id="${slug}">${renderedText}</h${depth}>\n`;
    };

    const html = marked.parse(markdown, { renderer });
    const tocHtml = buildTocHtml(headings);

    return { html, tocHtml };
}

/**
 * Build TOC markup from heading data.
 */
function buildTocHtml(headings) {
    if (headings.length === 0) {
        return "        <div class=\"item toc-empty\">No sections available</div>";
    }

    const root = { level: 1, children: [] };
    const stack = [root];

    headings.forEach((heading) => {
        const level = Math.min(Math.max(heading.level, 2), 6);

        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }

        const node = { ...heading, level, children: [] };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
    });

    const rendered = renderTocNodes(root.children, 0);
    return rendered ? `        <div class="toc-items">\n${rendered}\n        </div>` : "";
}

function renderTocNodes(nodes, depth) {
    if (!nodes || nodes.length === 0) {
        return "";
    }

    const indent = "        " + "    ".repeat(depth);
    const childIndent = "        " + "    ".repeat(depth + 1);

    return nodes
        .map((node) => {
            const nodeClass = ` level-${node.level}`;
            let html = `${indent}<div class="item toc-item${nodeClass}" data-target="${node.slug}">\n`;
            html += `${indent}    <a href="#${node.slug}">${escapeHtml(node.text)}</a>\n`;
            html += `${indent}</div>`;

            if (node.children && node.children.length > 0) {
                const childrenHtml = renderTocNodes(node.children, depth + 1);
                html += `\n${childIndent}<div class="toc-children">\n${childrenHtml}\n${childIndent}</div>`;
            }

            return html;
        })
        .join("\n");
}

/**
 * Strip HTML tags from text.
 */
function stripHtml(value) {
    return String(value || "").replace(/<[^>]*>/g, "");
}

/**
 * Convert heading text into a URL-friendly slug.
 */
function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/&amp;/g, "and")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "section";
}

/**
 * Replace placeholders in the template with content.
 */
function fillTemplate(template, data) {
    return Object.entries(data).reduce((acc, [key, value]) => {
        return acc.split(`{{${key}}}`).join(value);
    }, template);
}

/**
 * Escape HTML special characters for safe insertion.
 */
function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

buildPosts().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

