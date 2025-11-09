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

function smoothScrollTo(element, duration) {
    const targetPosition = element.getBoundingClientRect().top + window.scrollY;
    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = ease(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    function ease(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return (c / 2) * t * t + b;
        t--;
        return (-c / 2) * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
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

if (headings.length > 0) {
    const observerOptions = {
        root: null,
        rootMargin: "0px",
        threshold: 0.3,
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const mapping = headings.find(({ heading }) => heading === entry.target);
            if (!mapping) {
                return;
            }

            if (entry.isIntersecting) {
                tocItems.forEach((item) => item.classList.remove("selected"));
                mapping.item.classList.add("selected");
            }
        });
    }, observerOptions);

    headings.forEach(({ heading }) => observer.observe(heading));

    // Set the first item as selected by default.
    headings[0].item.classList.add("selected");
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

