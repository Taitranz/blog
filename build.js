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

        validateFrontmatter(file, data);

        const slug = data.slug || file.replace(/\.md$/i, "");
        const urlFromFrontmatter = typeof data.url === "string" ? data.url.trim() : "";
        const canonicalUrl = urlFromFrontmatter || `${ROOT_URL}/posts/${slug}.html`;

        const htmlContent = marked.parse(content);

        const rendered = fillTemplate(template, {
            title: escapeHtml(data.title),
            description: escapeHtml(data.description || ""),
            keywords: buildKeywords(data),
            url: canonicalUrl,
            date: escapeHtml(data.date || ""),
            tags: buildTagsHtml(data.tags),
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

