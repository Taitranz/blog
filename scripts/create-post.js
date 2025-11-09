#!/usr/bin/env node
const path = require("path");
const fs = require("fs-extra");
const readline = require("readline");

const OUTPUT_DIR = path.join(__dirname, "..", "posts", "markdown");

async function main() {
    try {
        const args = parseArgs(process.argv.slice(2));
        const title = await requireValue(args, "title", "Post title");
        const description = await requireValue(args, "description", "Short description");
        const tagsInput = await requireValue(args, "tags", "Comma-separated tags (e.g. tag1,tag2)");
        const date = (await optionalValue(args, "date", defaultDateTime())).trim();

        const tags = tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

        if (tags.length === 0) {
            throw new Error("At least one tag is required.");
        }

        const slug = (args.slug && args.slug.trim()) || slugify(title);
        const filename = `${slug}.md`;
        const targetPath = path.join(OUTPUT_DIR, filename);

        if (!(args.force === "true" || args.force === "1" || args.force === true)) {
            const exists = await fs.pathExists(targetPath);
            if (exists) {
                throw new Error(
                    `File ${path.relative(process.cwd(), targetPath)} already exists. Use --force=true to overwrite.`
                );
            }
        }

        const frontmatter = buildFrontmatter({ title, description, date, tags });

        await fs.ensureDir(OUTPUT_DIR);
        await fs.writeFile(targetPath, frontmatter, "utf8");

        console.log(`✓ Created ${path.relative(process.cwd(), targetPath)}`);
    } catch (error) {
        console.error(error.message ?? error);
        process.exitCode = 1;
    } finally {
        closeInterface();
    }
}

function parseArgs(rawArgs) {
    const args = {};
    for (let i = 0; i < rawArgs.length; i += 1) {
        const token = rawArgs[i];
        if (!token.startsWith("-")) {
            continue;
        }

        if (token.includes("=")) {
            const [key, ...rest] = token.replace(/^-+/, "").split("=");
            args[key.trim()] = rest.join("=").trim();
            continue;
        }

        const key = token.replace(/^-+/, "").trim();
        const next = rawArgs[i + 1];
        if (next && !next.startsWith("-")) {
            args[key] = next.trim();
            i += 1;
        } else {
            args[key] = true;
        }
    }
    return args;
}

async function requireValue(args, key, promptText) {
    const value = args[key];
    if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
    }

    return ask(`${promptText}: `);
}

async function optionalValue(args, key, fallback) {
    const value = args[key];
    if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
    }

    if (value === true) {
        return fallback;
    }

    return fallback;
}

function buildFrontmatter({ title, description, date, tags }) {
    const tagLines = tags.map((tag) => `  - ${escapeYaml(tag)}`).join("\n");
    return [
        "---",
        `title: "${escapeYaml(title)}"`,
        `date: "${escapeYaml(date)}"`,
        `description: "${escapeYaml(description)}"`,
        "tags:",
        tagLines || "  -",
        "---",
        "",
        "",
    ].join("\n");
}

function escapeYaml(value) {
    return String(value || "").replace(/"/g, '\\"');
}

function defaultDateTime() {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    const offsetMinutes = -now.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(offsetMinutes);
    const offsetHours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
    const offsetRemainingMinutes = String(absMinutes % 60).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemainingMinutes}`;
}

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

let rl;
function getInterface() {
    if (!rl) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }
    return rl;
}

function ask(question) {
    return new Promise((resolve) => {
        const interfaceInstance = getInterface();
        interfaceInstance.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

function closeInterface() {
    if (rl) {
        rl.close();
        rl = null;
    }
}

main();

