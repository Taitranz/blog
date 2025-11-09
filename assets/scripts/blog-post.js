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

