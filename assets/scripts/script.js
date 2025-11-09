const navItems = document.querySelectorAll(".blog-nav .item");
const sections = document.querySelectorAll(".blog-main .section");

const options = {
    root: null,
    rootMargin: "0px",
    threshold: 0.3,
};

let observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            const sectionClass = entry.target.classList[1];
            navItems.forEach((item) => {
                item.classList.toggle("selected", item.classList.contains(sectionClass));
            });
        }
    });
}, options);

sections.forEach((section) => {
    observer.observe(section);
});

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

navItems.forEach((item) => {
    item.addEventListener("click", () => {
        const sectionClass = item.classList[1];
        const section = document.querySelector(`.section.${sectionClass}`);
        if (section) {
            smoothScrollTo(section, 1000);
        }

        navMenu.classList.remove("nav-visible");
        overlay.classList.remove("visible");
        hamburgerMenu.classList.remove("active");
    });
});

const hamburgerMenu = document.querySelector(".hamburger-menu-centered");
const navMenu = document.querySelector(".blog-nav");
const overlay = document.querySelector(".overlay");

hamburgerMenu.addEventListener("click", () => {
    navMenu.classList.toggle("nav-visible");
    overlay.classList.toggle("visible");
    hamburgerMenu.classList.toggle("active");
});

// Deactivate hamburger menu on window resize
window.addEventListener("resize", () => {
    if (hamburgerMenu.classList.contains("active")) {
        hamburgerMenu.classList.remove("active");
        navMenu.classList.remove("nav-visible");
        overlay.classList.remove("visible");
    }
});

