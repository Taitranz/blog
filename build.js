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
        const canonicalUrl = urlFromFrontmatter || `${ROOT_URL}/posts/${slug}`;

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

        const postDir = path.join(OUTPUT_DIR, slug);
        await fs.ensureDir(postDir);
        const outputPath = path.join(postDir, "index.html");
        const minified = minifyHtml(rendered);
        await fs.writeFile(outputPath, minified, "utf8");

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

        if (depth === 2) {
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
            const brokenText = breakLongTitle(node.text);
            let html = `${indent}<div class="item toc-item${nodeClass}" data-target="${node.slug}">\n`;
            html += `${indent}    <a href="#${node.slug}">${brokenText}</a>\n`;
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
 * Break long titles at appropriate points (after periods, or at word boundaries).
 */
function breakLongTitle(text, maxLength = 50) {
    if (!text || text.length <= maxLength) {
        return escapeHtml(text);
    }

    // Try to break after periods first - look for periods that are in a good position
    // (not too early, ideally around 40-60% of the text length)
    const periodMatches = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '.' && i > 20 && i < text.length - 10) {
            periodMatches.push(i);
        }
    }

    // Find the best period to break at (closest to maxLength but not exceeding it)
    for (const periodIndex of periodMatches) {
        if (periodIndex <= maxLength + 10) {
            const beforePeriod = text.substring(0, periodIndex + 1).trim();
            const afterPeriod = text.substring(periodIndex + 1).trim();
            if (afterPeriod) {
                return escapeHtml(beforePeriod) + '<br>' + escapeHtml(afterPeriod);
            }
        }
    }

    // Try to break at word boundaries
    const words = text.split(/\s+/);
    let firstLine = '';
    let secondLine = '';

    for (const word of words) {
        if ((firstLine + ' ' + word).length <= maxLength) {
            firstLine += (firstLine ? ' ' : '') + word;
        } else {
            secondLine += (secondLine ? ' ' : '') + word;
        }
    }

    if (secondLine) {
        return escapeHtml(firstLine) + '<br>' + escapeHtml(secondLine);
    }

    return escapeHtml(text);
}

function buildDescriptionTocItem(description) {
    const label = breakLongTitle(description || "Description");
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
 * Minify HTML by removing unnecessary whitespace.
 */
function minifyHtml(html) {
    if (typeof html !== "string") {
        return html;
    }

    // Preserve whitespace in pre, code, textarea, script, and style blocks
    const preservedBlocks = [];
    let blockIndex = 0;
    
    // Match opening and closing tags more carefully to handle nested tags
    const blockPattern = /<(pre|code|textarea|script|style)([^>]*)>([\s\S]*?)<\/\1>/gi;
    html = html.replace(blockPattern, (match, tag, attrs, content) => {
        const placeholder = `__PRESERVED_BLOCK_${blockIndex++}__`;
        preservedBlocks.push({ placeholder, content: match });
        return placeholder;
    });

    // Remove HTML comments
    html = html.replace(/<!--[\s\S]*?-->/g, "");

    // Collapse whitespace between tags (but keep single newline for readability in some cases)
    html = html.replace(/>\s+</g, "><");

    // Remove leading/trailing whitespace from each line
    html = html.replace(/^[ \t]+|[ \t]+$/gm, "");

    // Collapse multiple consecutive newlines into single newline
    html = html.replace(/\n{3,}/g, "\n\n");

    // Collapse multiple spaces into single space (but preserve in preserved blocks)
    html = html.replace(/[ \t]{2,}/g, " ");

    // Remove spaces before closing tags
    html = html.replace(/[ \t]+>/g, ">");

    // Restore preserved blocks
    preservedBlocks.forEach(({ placeholder, content }) => {
        html = html.replace(placeholder, content);
    });

    return html.trim();
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
async function extractPostMetadata(htmlPath, slug) {
    const html = await fs.readFile(htmlPath, "utf8");
    const $ = cheerio.load(html, { decodeEntities: false });

    const rawTitle = $("head > title").first().text().trim();
    const title = stripBlogTitleSuffix(rawTitle) || fallbackTitleFromPath(slug || htmlPath);

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

    // Use slug (directory name) for href, or fallback to directory name from path
    const postSlug = slug || path.basename(path.dirname(htmlPath));

    return {
        fileName: `${postSlug}/index.html`,
        href: `posts/${postSlug}`,
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
    const posts = [];

    for (const entry of entries) {
        const entryPath = path.join(OUTPUT_DIR, entry);
        const stat = await fs.stat(entryPath);
        
        // Look for directories with index.html files
        if (stat.isDirectory()) {
            const indexPath = path.join(entryPath, "index.html");
            const indexExists = await fs.pathExists(indexPath);
            
            if (indexExists) {
                try {
                    const metadata = await extractPostMetadata(indexPath, entry);
                    if (metadata) {
                        posts.push(metadata);
                    }
                } catch (error) {
                    console.warn(`Skipping ${path.relative(__dirname, indexPath)}: ${error.message}`);
                }
            }
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
        // Temporarily disable minification for index.html to fix TOC
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
 * Parse blog date strings in ISO format (YYYY-MM-DDTHH:mm:ss+TZ), DD-MM-YYYY, or YYYY-MM-DD format.
 */
function parsePostDate(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
        return null;
    }

    // Try ISO date format first (e.g., "2025-11-10T12:00:00+10:00")
    const isoDate = new Date(trimmed);
    if (!Number.isNaN(isoDate.getTime())) {
        return isoDate;
    }

    // Fall back to DD-MM-YYYY or YYYY-MM-DD format
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

function fallbackTitleFromPath(htmlPathOrSlug) {
    // If it's a slug (string without path separators), use it directly
    if (typeof htmlPathOrSlug === "string" && !htmlPathOrSlug.includes(path.sep) && !htmlPathOrSlug.includes("/")) {
        const slug = htmlPathOrSlug;
        return slug.replace(/[-_]+/g, " ").replace(/\s+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
    }
    
    // Otherwise, extract from file path
    const fileName = path.basename(htmlPathOrSlug, path.extname(htmlPathOrSlug));
    return fileName.replace(/[-_]+/g, " ").replace(/\s+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

buildPosts().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

