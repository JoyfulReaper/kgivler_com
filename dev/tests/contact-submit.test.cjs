const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../src/static/contact-submit.js"), "utf8");

function setup() {
    const listeners = {};
    const classes = new Set();
    const attributes = new Map();
    const button = {
        disabled: false,
        textContent: "Send message",
        classList: {
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            contains: name => classes.has(name)
        },
        setAttribute: (name, value) => attributes.set(name, value),
        removeAttribute: name => attributes.delete(name),
        getAttribute: name => attributes.get(name)
    };
    const form = {
        querySelector: () => button,
        addEventListener: (type, callback) => listeners[type] = callback
    };
    const document = { querySelector: () => form };
    const window = { addEventListener: (type, callback) => listeners[type] = callback };
    vm.runInNewContext(script, { document, window });
    return {
        button,
        submit() {
            let prevented = false;
            listeners.submit({ preventDefault: () => prevented = true });
            return prevented;
        },
        pageshow: () => listeners.pageshow()
    };
}

test("button remains enabled until a valid form triggers submit", () => {
    const { button } = setup();
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, "Send message");
});

test("submit disables button, shows sending state and prevents duplicate submits", () => {
    const page = setup();
    assert.equal(page.submit(), false);
    assert.equal(page.button.disabled, true);
    assert.equal(page.button.textContent, "Sending…");
    assert.equal(page.button.classList.contains("is-submitting"), true);
    assert.equal(page.button.getAttribute("aria-busy"), "true");
    assert.equal(page.submit(), true);
});

test("pageshow resets button after browser back navigation", () => {
    const page = setup();
    page.submit();
    page.pageshow();
    assert.equal(page.button.disabled, false);
    assert.equal(page.button.textContent, "Send message");
    assert.equal(page.button.classList.contains("is-submitting"), false);
    assert.equal(page.button.getAttribute("aria-busy"), undefined);
    assert.equal(page.submit(), false);
});

test("form still works without script when no form exists", () => {
    const document = { querySelector: () => null };
    const window = { addEventListener: () => { throw new Error("listener should not be registered"); } };
    assert.doesNotThrow(() => vm.runInNewContext(script, { document, window }));
});
