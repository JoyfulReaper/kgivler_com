// Progressive enhancement: native form submission still works without JavaScript.
(() => {
    const form = document.querySelector(".contact-form");
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;

    const originalLabel = button.textContent;
    let submitting = false;

    // Submit fires only after the browser's built-in form validation succeeds.
    form.addEventListener("submit", (event) => {
        if (submitting) {
            event.preventDefault();
            return;
        }

        submitting = true;
        button.disabled = true;
        button.classList.add("is-submitting");
        button.setAttribute("aria-busy", "true");
        button.textContent = "Sending…";
    });

    // Browsers may restore this page from the back/forward cache after an error.
    window.addEventListener("pageshow", () => {
        submitting = false;
        button.disabled = false;
        button.classList.remove("is-submitting");
        button.removeAttribute("aria-busy");
        button.textContent = originalLabel;
    });
})();
