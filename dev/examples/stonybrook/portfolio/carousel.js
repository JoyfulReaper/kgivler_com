
"use strict";

(() => {
    const carousel = document.getElementById("portfolio-carousel");
    if (!carousel) return;

    const viewport = carousel.querySelector(".portfolio-carousel-viewport");
    const slides = [...carousel.querySelectorAll(".portfolio-slide")];
    const indicators = [...carousel.querySelectorAll(".portfolio-indicator")];
    const previous = carousel.querySelector(".portfolio-carousel-prev");
    const next = carousel.querySelector(".portfolio-carousel-next");

    const count = document.getElementById("portfolio-carousel-count");
    const title = document.getElementById("portfolio-carousel-title");
    const category = document.getElementById("portfolio-carousel-category");
    const description = document.getElementById("portfolio-carousel-description");
    const status = document.getElementById("portfolio-carousel-status");

    const projects = [
        {
            title: "The Garden Retreat",
            category: "Landscape Design · Garden Planting",
            description:
                "A peaceful garden setting where layered planting, " +
                "soft greenery, and winding pathways create a welcoming " +
                "escape from everyday life."
        },
        {
            title: "The Stone Terrace",
            category: "Patios · Hardscaping",
            description:
                "Natural stone and carefully selected planting come " +
                "together to create an inviting space for relaxing, " +
                "gathering, and enjoying the outdoors."
        },
        {
            title: "Outdoor Living",
            category: "Outdoor Spaces · Entertaining",
            description:
                "An outdoor environment that feels like an extension " +
                "of the home, balancing comfortable gathering spaces " +
                "with the beauty of the surrounding landscape."
        },
        {
            title: "The Woodland Garden",
            category: "Garden Design · Planting",
            description:
                "A lush, naturalistic garden that brings together " +
                "stone steps, layered foliage, and a sense of quiet " +
                "discovery."
        }
    ];

    if (!slides.length || slides.length !== indicators.length ||
        slides.length !== projects.length) {
        return;
    }

    let current = 0;
    let touchStartX = null;
    let touchStartY = null;

    function showSlide(index, announce = true) {
        current = (index + slides.length) % slides.length;

        slides.forEach((slide, i) => {
            const active = i === current;
            slide.classList.toggle("is-active", active);
            slide.setAttribute("aria-hidden", String(!active));
        });

        indicators.forEach((indicator, i) => {
            const active = i === current;
            indicator.classList.toggle("is-active", active);

            if (active) {
                indicator.setAttribute("aria-current", "true");
            } else {
                indicator.removeAttribute("aria-current");
            }
        });

        const project = projects[current];

        count.textContent =
            `${String(current + 1).padStart(2, "0")} / ` +
            `${String(slides.length).padStart(2, "0")}`;

        title.textContent = project.title;
        category.textContent = project.category;
        description.textContent = project.description;

        if (announce) {
            status.textContent =
                `Photograph ${current + 1} of ${slides.length}: ${project.title}`;
        }
    }

    previous.addEventListener("click", () => {
        showSlide(current - 1);
    });

    next.addEventListener("click", () => {
        showSlide(current + 1);
    });

    indicators.forEach((indicator, index) => {
        indicator.addEventListener("click", () => {
            showSlide(index);
        });
    });

    carousel.addEventListener("keydown", event => {
        // Preserve arrow-key behavior in form controls, if any are added.
        if (event.target.matches("input, textarea, select")) return;

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            showSlide(current - 1);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            showSlide(current + 1);
        }
    });

    viewport.addEventListener("touchstart", event => {
        if (event.touches.length !== 1) return;

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
    }, { passive: true });

    viewport.addEventListener("touchend", event => {
        if (touchStartX === null || touchStartY === null) return;
        if (!event.changedTouches.length) return;

        const deltaX = event.changedTouches[0].clientX - touchStartX;
        const deltaY = event.changedTouches[0].clientY - touchStartY;

        touchStartX = null;
        touchStartY = null;

        // Don't interfere with normal vertical page scrolling.
        if (Math.abs(deltaX) < 50 ||
            Math.abs(deltaX) <= Math.abs(deltaY)) {
            return;
        }

        showSlide(current + (deltaX < 0 ? 1 : -1));
    }, { passive: true });

    viewport.addEventListener("touchcancel", () => {
        touchStartX = null;
        touchStartY = null;
    });

    showSlide(0, false);
})();
