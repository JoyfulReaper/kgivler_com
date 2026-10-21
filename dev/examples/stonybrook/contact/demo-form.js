"use strict";

(() => {
    const form = document.getElementById("demo-contact-form");
    const status = document.getElementById("demo-submit-status");
    const submit = form?.querySelector('button[type="submit"]');

    // Keep submission disabled unless the local-only handler is ready.
    if (!form || !status || !submit) return;

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        // The browser validates required fields and email before this event.
        // Never read, transmit, or persist the values entered.
        form.reset();
        status.textContent =
            "Demo complete! The required fields passed validation. Nothing was sent or saved.";
        status.hidden = false;
        status.focus();
    });

    const clearConfirmation = () => {
        status.hidden = true;
    };
    form.addEventListener("input", clearConfirmation);
    form.addEventListener("change", clearConfirmation);

    // Register every handler before enabling the submit button.
    submit.disabled = false;
})();
