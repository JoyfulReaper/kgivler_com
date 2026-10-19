
"use strict";

(() => {
    const carousel = document.getElementById("portfolio-carousel");
    if (!carousel) return;

    const viewport = carousel.querySelector(".portfolio-carousel-viewport");
    const slides = [...carousel.querySelectorAll(".portfolio-slide")];
    const indicators = [...carousel.querySelectorAll(".portfolio-indicator")];
    const previous = carousel.querySelector(".portfolio-carousel-prev");
    const next = carousel.querySelector(".portfolio-carousel-next");

    const hint = carousel.querySelector(".portfolio-carousel-hint");
    const indicatorGroup = carousel.querySelector(".portfolio-carousel-indicators");
    const status = document.getElementById("portfolio-carousel-status");

    // Keep the complete HTML gallery if any enhancement prerequisite is missing.
    const titles = slides.map(slide => slide.querySelector("h3"));
    if (!viewport || !previous || !next || !hint || !indicatorGroup || !status ||
        !slides.length || slides.length !== indicators.length ||
        titles.some(title => !title) ||
        slides.some(slide => !slide.querySelector("img") ||
            !slide.querySelector(".portfolio-carousel-description"))) {
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

        if (announce) {
            status.textContent =
                `Image ${current + 1} of ${slides.length}: ${titles[current].textContent.trim()}`;
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
        touchStartX = null;
        touchStartY = null;
        // Captions now share the viewport grid; swiping remains image-only.
        if (event.touches.length !== 1 ||
            !event.target.closest(".portfolio-slide img")) return;

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

    // Publish the enhanced state only after every control has been wired.
    showSlide(0, false);
    slides.forEach(slide => slide.setAttribute("aria-roledescription", "slide"));
    carousel.setAttribute("aria-roledescription", "carousel");
    carousel.classList.add("is-enhanced");
    [hint, previous, next, indicatorGroup].forEach(control => { control.hidden = false; });
})();
