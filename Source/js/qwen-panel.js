import { elements } from "./ui.js";
import { escapeHtml, renderMarkdown } from "./markdown.js";
import { getQwenCoderHealth, submitQwenCoderReview } from "./api.js";

const createTerminalContext = (element) => ({
  print: (html) => {
    element.innerHTML = html;
  },
  error: (msg) => {
    element.innerHTML = `<span class="text-danger">${msg}</span>`;
  },
  loading: (msg) => {
    element.innerHTML = `<span class="text-warning">${msg}</span>`;
  },
  clear: () => {
    element.innerHTML = "";
  },
});

const qwenReviewTerminal = elements.qwenReviewOutput
  ? createTerminalContext(elements.qwenReviewOutput)
  : null;

const badSampleCode = `const API_URL = "http://localhost:5000/api/code-review";
const TOKEN = "SUPER_SECRET_ADMIN_TOKEN_123";

export async function submitReview() {
    const code = document.getElementById("codeReviewInput").value;
    const output = document.getElementById("code-review-output");

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + TOKEN,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ code })
    });

    const data = await response.json();

    output.innerHTML = data.review;

    localStorage.setItem("lastCode", code);
    console.log("Submitted code:", code);
}`;

function setQwenHealthBadge(state, text) {
  if (!elements.qwenHealthBadge) return;

  const classes = ["qwen-health-pill", "badge", "rounded-pill"];
  elements.qwenHealthBadge.className = classes.join(" ");
  elements.qwenHealthBadge.textContent = text;
  elements.qwenHealthBadge.dataset.state = state;
}

function renderQwenReview(review) {
  const markdown = renderMarkdown(review);
  return `<div class="project-terminal-badge qwen-review-output markdown-output">${markdown || `<pre class="mb-0">${escapeHtml(review)}</pre>`}</div>`;
}

async function refreshQwenHealth() {
  setQwenHealthBadge("pending", "Checking...");

  const data = await getQwenCoderHealth();

  if (!data || data.ok === false) {
    setQwenHealthBadge("offline", "Offline");
    if (elements.qwenReviewOutput && qwenReviewTerminal) {
      qwenReviewTerminal.print(`<span class="text-danger">QwenCoder health check failed: ${escapeHtml(data?.error || "unknown error")}</span>`);
    }
    return data;
  }

  const state = data.modelAvailable ? "online" : "warning";
  const label = data.modelAvailable ? "Online" : "Model Missing";
  setQwenHealthBadge(state, label);
  return data;
}

async function runQwenReview() {
  if (!elements.qwenCodeInput || !qwenReviewTerminal) return;

  const code = elements.qwenCodeInput.value || "";
  const language = elements.qwenLanguage?.value || "auto";

  if (!code.trim()) {
    qwenReviewTerminal.error("Paste some code first.");
    return;
  }

  qwenReviewTerminal.loading("Sending code to QwenCoder... Please wait, this can take a long time...");
  if (elements.qwenReviewButton) elements.qwenReviewButton.disabled = true;
  if (elements.qwenHealthButton) elements.qwenHealthButton.disabled = true;

  try {
    const result = await submitQwenCoderReview(code, language);

    if (!result || result.ok === false) {
      qwenReviewTerminal.error(result?.error || "Code review failed.");
      return;
    }

    const review = result.review || result.Review || "";

    if (!review.trim()) {
      qwenReviewTerminal.error("QwenCoder returned an empty review.");
      return;
    }

    qwenReviewTerminal.print(renderQwenReview(review));
  } finally {
    if (elements.qwenReviewButton) elements.qwenReviewButton.disabled = false;
    if (elements.qwenHealthButton) elements.qwenHealthButton.disabled = false;
  }
}

function clearQwenReview() {
  if (!qwenReviewTerminal) return;

  qwenReviewTerminal.clear();
  if (elements.qwenCodeInput) {
    elements.qwenCodeInput.value = "";
    elements.qwenCodeInput.focus();
  }
}

function loadBadSample() {
  if (!elements.qwenCodeInput) return;

  elements.qwenCodeInput.value = badSampleCode;
  if (elements.qwenLanguage) {
    elements.qwenLanguage.value = "javascript";
  }
  elements.qwenCodeInput.focus();
}

export function initQwenPanel() {
  if (!elements.qwenReviewOutput) return;

  refreshQwenHealth().catch(console.error);

  elements.qwenHealthButton?.addEventListener("click", () => refreshQwenHealth());
  elements.qwenLoadBadSampleButton?.addEventListener("click", () => loadBadSample());
  elements.qwenReviewButton?.addEventListener("click", () => runQwenReview());
  elements.qwenClearButton?.addEventListener("click", () => clearQwenReview());
  elements.qwenCodeInput?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      runQwenReview();
    }
  });
}
