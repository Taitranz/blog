const path = require("path");
const fs = require("fs-extra");
const matter = require("gray-matter");
const { marked } = require("marked");
const cheerio = require("cheerio");
const hljs = require("highlight.js");

const ROOT_URL = "https://blog.taitranz.com";
const SOURCE_DIR = path.join(__dirname, "posts", "markdown");
const OUTPUT_DIR = path.join(__dirname, "posts");
const TEMPLATE_PATH = path.join(__dirname, "posts", "template.html");
const INDEX_PATH = path.join(__dirname, "index.html");
const BLOG_TITLE_SUFFIX = " — Tai Tran Blog";

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

        const { html: htmlContent, tocHtml } = renderMarkdownWithToc(content, data.description);
        const { bannerHtml, contentHtml } = extractBannerImage(htmlContent);

        const rendered = fillTemplate(template, {
            title: escapeHtml(data.title),
            description: escapeHtml(data.description || ""),
            keywords: buildKeywords(data),
            url: canonicalUrl,
            date: escapeHtml(data.date || ""),
            tags: buildTagsHtml(data.tags),
            toc: tocHtml,
            banner: bannerHtml,
            content: contentHtml,
        });

        const outputPath = path.join(OUTPUT_DIR, `${slug}.html`);
        await fs.writeFile(outputPath, rendered.trim() + "\n", "utf8");

        console.log(`✓ Built ${outputPath}`);
    }

    const posts = await scanAllPosts();
    await updateIndexHtml(posts);
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
function renderMarkdownWithToc(markdown, description) {
    const headings = [];
    const renderer = new marked.Renderer();
    const slugCounts = new Map();

    renderer.heading = function ({ tokens, depth }) {
        const renderedText = this.parser.parseInline(tokens);
        const baseSlug = slugify(stripHtml(renderedText));
        const count = slugCounts.get(baseSlug) || 0;
        slugCounts.set(baseSlug, count + 1);
        const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;

        if (depth >= 2 && depth <= 6 && depth !== 3) {
            headings.push({
                level: depth,
                text: stripHtml(renderedText),
                slug,
            });
        }
        return `<h${depth} id="${slug}">${renderedText}</h${depth}>\n`;
    };

    renderer.code = function ({ text, lang }) {
        const language = lang || "";
        let highlighted;
        if (lang) {
            try {
                highlighted = hljs.highlight(text, { language: lang }).value;
            } catch (err) {
                highlighted = escapeHtml(text);
            }
        } else {
            highlighted = escapeHtml(text);
        }
        return `<pre><code class="hljs${language ? ` language-${language}` : ""}">${highlighted}</code></pre>\n`;
    };

    const html = marked.parse(markdown, { renderer });
    const tocHtml = buildTocHtml(headings, description);

    return { html, tocHtml };
}

/**
 * Extract a leading banner image from the rendered HTML (if present).
 */
function extractBannerImage(html) {
    if (typeof html !== "string" || html.trim() === "") {
        return { bannerHtml: "", contentHtml: html || "" };
    }

    const $ = cheerio.load(html, { decodeEntities: false }, false);
    const container = $("body").length ? $("body") : $.root();
    const meaningfulNodes = container
        .contents()
        .filter((_, node) => {
            if (node.type === "text") {
                return Boolean((node.data || "").trim());
            }
            return node.type === "tag";
        });

    if (meaningfulNodes.length === 0) {
        return { bannerHtml: "", contentHtml: html };
    }

    const firstNode = meaningfulNodes.first();
    let bannerHtml = "";

    const firstElement = firstNode[0];

    if (firstElement?.type === "tag") {
        if (firstElement.name === "img") {
            const imgHtml = $.html(firstNode);
            if (imgHtml) {
                bannerHtml = wrapBannerHtml(imgHtml);
                firstNode.remove();
            }
        } else if (firstElement.name === "p") {
            const meaningfulChildren = firstNode
                .contents()
                .filter((_, node) => {
                    if (node.type === "text") {
                        return Boolean((node.data || "").trim());
                    }
                    return node.type === "tag";
                });

            const firstChild = meaningfulChildren.first();

            if (meaningfulChildren.length === 1 && firstChild[0]?.name === "img") {
                const imgHtml = $.html(firstChild);
                if (imgHtml) {
                    bannerHtml = wrapBannerHtml(imgHtml);
                    firstNode.remove();
                }
            }
        }
    }

    if (!bannerHtml) {
        return { bannerHtml: "", contentHtml: html };
    }

    const contentHtml = (container.html() || "").trim();
    return { bannerHtml, contentHtml };
}

function wrapBannerHtml(imgHtml) {
    return `<div class="blog-banner">\n                        ${imgHtml}\n                    </div>`;
}

/**
 * Build TOC markup from heading data.
 */
function buildTocHtml(headings, description) {
    const descriptionItem = buildDescriptionTocItem(description);

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

    if (!rendered && !descriptionItem) {
        return "";
    }

    const items = [];

    if (descriptionItem) {
        items.push(descriptionItem);
    }

    if (rendered) {
        items.push(rendered);
    }

    return `        <div class="toc-items">\n${items.join("\n")}\n        </div>`;
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

function buildDescriptionTocItem(description) {
    const label = escapeHtml(description || "Description");
    return `            <div class="item toc-item level-description" data-target="post-top">\n                <a href="#post-top">${label}</a>\n            </div>`;
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

/**
 * Extract relevant metadata from a rendered blog HTML file.
 */
async function extractPostMetadata(htmlPath) {
    const html = await fs.readFile(htmlPath, "utf8");
    const $ = cheerio.load(html, { decodeEntities: false });

    const rawTitle = $("head > title").first().text().trim();
    const title = stripBlogTitleSuffix(rawTitle) || fallbackTitleFromPath(htmlPath);

    const dateText = $(".blog-container .details .date").first().text().trim();
    const dateValue = parsePostDate(dateText);

    if (!dateValue) {
        console.warn(`Skipping ${path.relative(__dirname, htmlPath)}: unable to parse date "${dateText}"`);
        return null;
    }

    const tags = $(".blog-container .details .tags .tag")
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean);

    // Extract banner image if present
    const bannerImg = $(".blog-container .blog-banner img").first();
    let bannerImageSrc = null;
    let bannerImageAlt = "";
    
    if (bannerImg.length) {
        bannerImageSrc = bannerImg.attr("src");
        bannerImageAlt = bannerImg.attr("alt") || "";
        
        // Convert relative path from blog post (../../assets/) to index.html path (assets/)
        if (bannerImageSrc && bannerImageSrc.startsWith("../../")) {
            bannerImageSrc = bannerImageSrc.replace("../../", "");
        }
    }

    const fileName = path.basename(htmlPath);

    return {
        fileName,
        href: `posts/${fileName}`,
        title,
        dateDisplay: dateText,
        dateValue,
        tags,
        bannerImageSrc,
        bannerImageAlt,
    };
}

/**
 * Scan all generated HTML posts and sort them by date (newest first).
 */
async function scanAllPosts() {
    const exists = await fs.pathExists(OUTPUT_DIR);
    if (!exists) {
        return [];
    }

    const entries = await fs.readdir(OUTPUT_DIR);
    const htmlFiles = entries.filter(
        (file) => file.toLowerCase().endsWith(".html") && file.toLowerCase() !== "template.html"
    );

    const posts = [];

    for (const file of htmlFiles) {
        const htmlPath = path.join(OUTPUT_DIR, file);
        try {
            const metadata = await extractPostMetadata(htmlPath);
            if (metadata) {
                posts.push(metadata);
            }
        } catch (error) {
            console.warn(`Skipping ${path.relative(__dirname, htmlPath)}: ${error.message}`);
        }
    }

    return posts.sort((a, b) => b.dateValue.getTime() - a.dateValue.getTime());
}

/**
 * Build the Overview and Blogs sections markup.
 */
function generateBlogListingsHtml(posts, { overviewUlIndent, blogContainerIndent }) {
    return {
        overviewContent: renderOverviewList(posts, overviewUlIndent),
        blogsContent: renderBlogContainers(posts, blogContainerIndent),
    };
}

/**
 * Update index.html with the provided post data.
 */
async function updateIndexHtml(posts) {
    const indexExists = await fs.pathExists(INDEX_PATH);
    if (!indexExists) {
        console.warn(`index.html not found at ${path.relative(process.cwd(), INDEX_PATH)}. Skipping homepage update.`);
        return;
    }

    let indexHtml = await fs.readFile(INDEX_PATH, "utf8");
    const lineBreak = indexHtml.includes("\r\n") ? "\r\n" : "\n";

    const overviewUlIndent = findIndentation(indexHtml, '<div class="overview-toc">', "<ul>") || "                    ";
    const blogContainerIndent = findIndentation(
        indexHtml,
        '<section class="section blogs">',
        '<div class="blog-container">'
    ) || "                ";

    const { overviewContent, blogsContent } = generateBlogListingsHtml(posts, {
        overviewUlIndent,
        blogContainerIndent,
    });

    const updatedOverview = replaceOverviewList(indexHtml, overviewContent, lineBreak, overviewUlIndent);
    const updatedBlogs = replaceBlogsSection(updatedOverview.html, blogsContent, lineBreak, blogContainerIndent);

    if (updatedOverview.changed || updatedBlogs.changed) {
        await fs.writeFile(INDEX_PATH, updatedBlogs.html, "utf8");
        console.log(`✓ Updated ${path.relative(process.cwd(), INDEX_PATH)}`);
    } else {
        console.log("No changes detected for index.html");
    }
}

/**
 * Replace the Overview list content.
 */
function replaceOverviewList(html, overviewContent, lineBreak, ulIndent) {
    const overviewRegex = /(<div class="overview-toc">[\s\S]*?<ul>)([\s\S]*?)(\s*<\/ul>)/;
    const match = overviewRegex.exec(html);

    if (!match) {
        console.warn("Unable to locate overview list in index.html. Skipping update for Overview section.");
        return { html, changed: false };
    }

    const block = overviewContent ? `${lineBreak}${overviewContent}${lineBreak}${ulIndent}` : "";
    const nextHtml = html.replace(overviewRegex, (_, start, _current, end) => `${start}${block}${end}`);

    return { html: nextHtml, changed: nextHtml !== html };
}

/**
 * Replace the Blogs section listings.
 */
function replaceBlogsSection(html, blogsContent, lineBreak, baseIndent) {
    const blogsRegex = /(<section class="section blogs">[\s\S]*?<h2>Blogs<\/h2>\s*)([\s\S]*?)(\s*<\/div>\s*<\/section>)/;
    const match = blogsRegex.exec(html);

    if (!match) {
        console.warn("Unable to locate blogs section in index.html. Skipping update for Blogs section.");
        return { html, changed: false };
    }

    const block = blogsContent ? `${lineBreak}${blogsContent}${lineBreak}${baseIndent}` : "";
    const nextHtml = html.replace(blogsRegex, (_, start, _current, end) => `${start}${block}${end}`);

    return { html: nextHtml, changed: nextHtml !== html };
}

/**
 * Render the list items for the Overview section.
 */
function renderOverviewList(posts, ulIndent) {
    if (!posts || posts.length === 0) {
        return "";
    }

    const liIndent = `${ulIndent}    `;
    return posts
        .map((post) => {
            const lines = [
                `${liIndent}<li>`,
                `${liIndent}    <a href="${escapeHtml(post.href)}">`,
                `${liIndent}        - ${escapeHtml(post.title)}`,
                `${liIndent}    </a>`,
                `${liIndent}</li>`,
            ];
            return lines.join("\n");
        })
        .join("\n");
}

/**
 * Render the blog containers for the Blogs section.
 */
function renderBlogContainers(posts, baseIndent) {
    if (!posts || posts.length === 0) {
        return "";
    }

    const step = "    ";

    return posts
        .map((post) => {
            const indent1 = `${baseIndent}${step}`;
            const indent2 = `${indent1}${step}`;
            const indent3 = `${indent2}${step}`;
            const indent4 = `${indent3}${step}`;

            const tagsLines = [`${indent2}<div class="tags">`];
            if (post.tags && post.tags.length > 0) {
                tagsLines.push(
                    post.tags
                        .map((tag) => {
                            return [
                                `${indent3}<div class="tag">`,
                                `${indent4}${escapeHtml(tag)}`,
                                `${indent3}</div>`,
                            ].join("\n");
                        })
                        .join("\n")
                );
            }
            tagsLines.push(`${indent2}</div>`);

            const imageLines = [];
            if (post.bannerImageSrc) {
                imageLines.push(
                    `${indent1}<div class="blog-listing-image">`,
                    `${indent2}<img src="${escapeHtml(post.bannerImageSrc)}" alt="${escapeHtml(post.bannerImageAlt || post.title)}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-top: 0;">`,
                    `${indent1}</div>`
                );
            }

            return [
                `${baseIndent}<div class="blog-container">`,
                `${indent1}<div class="title">`,
                `${indent2}<a href="${escapeHtml(post.href)}">${escapeHtml(post.title)} <span style="font-size: 14px; font-weight: 400; color: #999; letter-spacing: -0.3px;">(click me)</span></a>`,
                `${indent1}</div>`,
                ...imageLines,
                `${indent1}<div class="details">`,
                `${indent2}<div class="date">`,
                `${indent3}${escapeHtml(post.dateDisplay)}`,
                `${indent2}</div>`,
                ...tagsLines,
                `${indent1}</div>`,
                `${baseIndent}</div>`,
            ].join("\n");
        })
        .join("\n\n");
}

/**
 * Locate indentation for a specific tag following a marker within HTML.
 */
function findIndentation(html, marker, tag) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) {
        return "";
    }

    const tagIndex = html.indexOf(tag, markerIndex);
    if (tagIndex === -1) {
        return "";
    }

    const lineStart = html.lastIndexOf("\n", tagIndex);
    if (lineStart === -1) {
        return "";
    }

    const line = html.slice(lineStart + 1, tagIndex);
    return line;
}

/**
 * Parse blog date strings in DD-MM-YYYY or YYYY-MM-DD format.
 */
function parsePostDate(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
        return null;
    }

    const parts = trimmed.split("-").map((part) => part.trim());
    if (parts.length !== 3) {
        return null;
    }

    let day;
    let month;
    let year;

    if (parts[0].length === 4) {
        [year, month, day] = parts.map((part) => Number.parseInt(part, 10));
    } else {
        [day, month, year] = parts.map((part) => Number.parseInt(part, 10));
    }

    if (
        Number.isNaN(day) ||
        Number.isNaN(month) ||
        Number.isNaN(year) ||
        day <= 0 ||
        month <= 0 ||
        month > 12
    ) {
        return null;
    }

    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    date.setHours(0, 0, 0, 0);
    return date;
}

function stripBlogTitleSuffix(title) {
    if (!title) {
        return "";
    }

    if (title.endsWith(BLOG_TITLE_SUFFIX)) {
        return title.slice(0, -BLOG_TITLE_SUFFIX.length).trim();
    }

    return title;
}

function fallbackTitleFromPath(htmlPath) {
    const fileName = path.basename(htmlPath, path.extname(htmlPath));
    return fileName.replace(/[-_]+/g, " ").replace(/\s+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

buildPosts().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

