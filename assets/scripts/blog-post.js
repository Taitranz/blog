const tocItems = Array.from(document.querySelectorAll(".blog-nav .toc-item"));
const headings = tocItems
    .map((item) => {
        const targetId = item.dataset.target;
        if (!targetId) {
            return null;
        }

        const heading = document.getElementById(targetId);
        return heading
            ? {
                  item,
                  heading,
              }
            : null;
    })
    .filter(Boolean);

const overlay = document.querySelector(".overlay");
const navMenu = document.querySelector(".blog-nav");
const hamburgerMenu = document.querySelector(".hamburger-menu-centered");

const prefersReducedMotionQuery = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

const scrollCancelEvents = [
    { type: "wheel", options: { passive: true } },
    { type: "touchstart", options: { passive: true } },
    { type: "touchmove", options: { passive: true } },
    { type: "keydown", options: false },
    { type: "mousedown", options: false },
];

let scrollAnimationFrame = null;
let cancelScrollListener = null;

function addScrollCancelListeners(listener) {
    scrollCancelEvents.forEach(({ type, options }) => window.addEventListener(type, listener, options));
}

function removeScrollCancelListeners(listener) {
    scrollCancelEvents.forEach(({ type, options }) => window.removeEventListener(type, listener, options));
}

function stopActiveScrollAnimation() {
    if (scrollAnimationFrame !== null) {
        cancelAnimationFrame(scrollAnimationFrame);
        scrollAnimationFrame = null;
    }

    if (cancelScrollListener) {
        removeScrollCancelListeners(cancelScrollListener);
        cancelScrollListener = null;
    }
}

function smoothScrollTo(element, duration = 1000) {
    if (!element) return;

    stopActiveScrollAnimation();

    const targetPosition = element.getBoundingClientRect().top + window.scrollY;

    if (prefersReducedMotionQuery.matches) {
        window.scrollTo({ top: targetPosition, behavior: "auto" });
        return;
    }

    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;

    if (Math.abs(distance) < 1) {
        return;
    }

    const minDuration = 250;
    const maxDuration = Math.max(duration, minDuration);
    const distanceInfluence = Math.abs(distance) * 0.5;
    const adjustedDuration = Math.min(maxDuration, Math.max(minDuration, distanceInfluence));

    const easeInOutCubic = (progress) =>
        progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    let startTime = null;

    const step = (timestamp) => {
        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / adjustedDuration, 1);
        const easedProgress = easeInOutCubic(progress);

        window.scrollTo(0, startPosition + distance * easedProgress);

        if (progress < 1) {
            scrollAnimationFrame = requestAnimationFrame(step);
        } else {
            stopActiveScrollAnimation();
        }
    };

    cancelScrollListener = () => {
        stopActiveScrollAnimation();
    };

    addScrollCancelListeners(cancelScrollListener);

    scrollAnimationFrame = requestAnimationFrame(step);
}

function closeMenu() {
    if (hamburgerMenu && navMenu && overlay) {
        hamburgerMenu.classList.remove("active");
        navMenu.classList.remove("nav-visible");
        overlay.classList.remove("visible");
    }
}

tocItems.forEach((item) => {
    item.addEventListener("click", (event) => {
        event.preventDefault();
        const targetId = item.dataset.target;
        const heading = targetId ? document.getElementById(targetId) : null;
        if (heading) {
            smoothScrollTo(heading, 800);
        }
        closeMenu();
    });
});

if (hamburgerMenu) {
    hamburgerMenu.addEventListener("click", () => {
        if (!navMenu || !overlay) return;
        hamburgerMenu.classList.toggle("active");
        navMenu.classList.toggle("nav-visible");
        overlay.classList.toggle("visible");
    });
}

if (overlay) {
    overlay.addEventListener("click", closeMenu);
}

// Find the TOC item that targets the post-top element
const postTopItem = tocItems.find((item) => item.dataset.target === "post-top");

if (headings.length > 0 || postTopItem) {
    const updateSelectedItem = () => {
        // If at the top of the page, select the post-top item
        if (window.scrollY < 100 && postTopItem) {
            tocItems.forEach((item) => item.classList.remove("selected"));
            postTopItem.classList.add("selected");
            return;
        }

        // Find the heading that's currently closest to the top of the viewport
        if (headings.length > 0) {
            let selectedHeading = null;
            let minTop = Infinity;

            // Check all headings to find the one closest to the top
            headings.forEach(({ heading }) => {
                const rect = heading.getBoundingClientRect();
                const top = rect.top;
                
                // Consider headings that are above or just below the top threshold
                // We want to select the heading that has passed the top of the viewport
                if (top <= 150 && top >= -100) {
                    // Prefer headings that are closer to the top (but have scrolled past)
                    if (top < minTop) {
                        minTop = top;
                        selectedHeading = heading;
                    }
                }
            });

            // If we found a heading, select it
            if (selectedHeading) {
                const mapping = headings.find(({ heading }) => heading === selectedHeading);
                if (mapping) {
                    tocItems.forEach((item) => item.classList.remove("selected"));
                    mapping.item.classList.add("selected");
                    return;
                }
            }

            // Fallback: if no heading is in the threshold, find the last one that passed
            let lastPassedHeading = null;
            headings.forEach(({ heading }) => {
                const rect = heading.getBoundingClientRect();
                if (rect.top < 0) {
                    // This heading has scrolled past the top
                    if (!lastPassedHeading || heading.offsetTop > lastPassedHeading.offsetTop) {
                        lastPassedHeading = heading;
                    }
                }
            });

            if (lastPassedHeading) {
                const mapping = headings.find(({ heading }) => heading === lastPassedHeading);
                if (mapping) {
                    tocItems.forEach((item) => item.classList.remove("selected"));
                    mapping.item.classList.add("selected");
                }
            }
        }
    };

    // Set the first item as selected by default.
    if (postTopItem) {
        postTopItem.classList.add("selected");
    } else if (headings[0]) {
        headings[0].item.classList.add("selected");
    }

    // Update selection on scroll
    let scrollTimeout = null;
    window.addEventListener("scroll", () => {
        if (scrollTimeout) {
            cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = requestAnimationFrame(() => {
            updateSelectedItem();
        });
    }, { passive: true });

    // Initial check
    updateSelectedItem();
}

// Deactivate hamburger menu on window resize
window.addEventListener("resize", () => {
    if (hamburgerMenu && hamburgerMenu.classList.contains("active")) {
        closeMenu();
    }
});

(function attachCopyButtons() {
    const codeBlocks = document.querySelectorAll(".blog-main pre > code");
    if (!codeBlocks || codeBlocks.length === 0) {
        return;
    }

    const resetDelay = 1500;

    const fallbackCopy = (text) => {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const success = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (!success) {
            throw new Error("document.execCommand('copy') returned false");
        }
    };

    codeBlocks.forEach((codeBlock) => {
        const pre = codeBlock.parentElement;
        if (!pre || pre.querySelector(".copy-code-btn")) {
            return;
        }

        pre.classList.add("has-copy");

        const button = document.createElement("button");
        button.type = "button";
        button.className = "copy-code-btn";
        button.setAttribute("aria-label", "Copy code to clipboard");
        button.textContent = "Copy";

        let resetTimer = null;

        const setFeedback = (message, stateClass) => {
            button.textContent = message;
            button.classList.remove("copy-success", "copy-error");
            if (stateClass) {
                button.classList.add(stateClass);
            }

            if (resetTimer) {
                clearTimeout(resetTimer);
            }

            resetTimer = window.setTimeout(() => {
                button.textContent = "Copy";
                button.classList.remove("copy-success", "copy-error");
            }, resetDelay);
        };

        button.addEventListener("click", async () => {
            const text = codeBlock.textContent || "";
            if (!text.trim()) {
                setFeedback("No code", "copy-error");
                return;
            }

            try {
                if (navigator.clipboard && typeof navigator.clipboard.writeText === "function" && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                } else {
                    fallbackCopy(text);
                }
                setFeedback("Copied!", "copy-success");
            } catch (error) {
                console.error("Failed to copy code block:", error);
                setFeedback("Copy failed", "copy-error");
            }
        });

        pre.appendChild(button);
    });
})();

