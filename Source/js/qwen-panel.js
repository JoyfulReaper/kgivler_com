import { elements, createTerminalContext } from "./ui.js";
import { escapeHtml, renderMarkdown } from "./markdown.js";
import { getQwenCoderHealth, submitQwenCoderReview } from "./api.js";

const qwenReviewTerminal = elements.qwenReviewOutput
  ? createTerminalContext(elements.qwenReviewOutput)
  : null;
let isRunningQwenReview = false;
let isCheckingQwenHealth = false;

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

function getMessage(value, fallback) {
  return typeof value === "string" && value.trim()
    ? value
    : fallback;
}

function setReviewOutputKind(kind) {
  if (!elements.qwenReviewOutput) return;

  elements.qwenReviewOutput.dataset.qwenOutputKind =
    kind;
}

function canShowHealthMessage() {
  if (isRunningQwenReview) {
    return false;
  }

  if (!elements.qwenReviewOutput) {
    return false;
  }

  const kind =
    elements.qwenReviewOutput.dataset.qwenOutputKind;

  return (
    !elements.qwenReviewOutput.textContent.trim() ||
    kind === "health"
  );
}

async function refreshQwenHealth() {
  if (isCheckingQwenHealth) {
    return null;
  }

  isCheckingQwenHealth = true;
  setQwenHealthBadge("pending", "Checking...");

  try {
    const data = await getQwenCoderHealth();

    if (!data || data.ok === false) {
      setQwenHealthBadge("offline", "Offline");
      if (
        qwenReviewTerminal &&
        canShowHealthMessage()
      ) {
        qwenReviewTerminal.printTrustedHtml(`<span class="text-danger">QwenCoder health check failed: ${escapeHtml(getMessage(data?.error, "unknown error"))}. Kyle is probably playing a video game or something...</span>`);
        setReviewOutputKind("health");
      }
      return data;
    }

    const modelAvailable =
      data?.modelAvailable === true;
    const state = modelAvailable ? "online" : "warning";
    const label = modelAvailable ? "Online" : "Model Missing";
    setQwenHealthBadge(state, label);
    return data;
  } catch (error) {
    console.error("QwenCoder health check failed:", error);
    setQwenHealthBadge("offline", "Offline");

    if (
      qwenReviewTerminal &&
      canShowHealthMessage()
    ) {
      qwenReviewTerminal.errorText("QwenCoder health check failed.");
      setReviewOutputKind("health");
    }

    return null;
  } finally {
    isCheckingQwenHealth = false;
  }
}

async function runQwenReview() {
  if (!elements.qwenCodeInput || !qwenReviewTerminal) return;
  if (isRunningQwenReview) return;

  const code = elements.qwenCodeInput.value || "";
  const language = elements.qwenLanguage?.value || "auto";

  if (!code.trim()) {
    qwenReviewTerminal.errorText("Paste some code first.");
    setReviewOutputKind("error");
    return;
  }

  isRunningQwenReview = true;
  qwenReviewTerminal.loadingText("Sending code to QwenCoder... Please wait, this can take a long time...");
  setReviewOutputKind("review-loading");
  if (elements.qwenReviewButton) elements.qwenReviewButton.disabled = true;
  if (elements.qwenHealthButton) elements.qwenHealthButton.disabled = true;

  try {
    const result = await submitQwenCoderReview(code, language);

    if (!result || result.ok === false) {
      qwenReviewTerminal.errorText(
        getMessage(
          result?.error,
          "Code review failed."
        )
      );
      setReviewOutputKind("review-error");
      return;
    }

    const review =
      typeof result.review === "string"
        ? result.review
        : typeof result.Review === "string"
          ? result.Review
          : "";

    if (!review.trim()) {
      qwenReviewTerminal.errorText("QwenCoder returned an empty review.");
      setReviewOutputKind("review-error");
      return;
    }

    qwenReviewTerminal.printTrustedHtml(renderQwenReview(review));
    setReviewOutputKind("review");
  } catch (error) {
    console.error("QwenCoder review failed:", error);
    qwenReviewTerminal.errorText("Code review failed unexpectedly.");
    setReviewOutputKind("review-error");
  } finally {
    isRunningQwenReview = false;
    if (elements.qwenReviewButton) elements.qwenReviewButton.disabled = false;
    if (elements.qwenHealthButton) elements.qwenHealthButton.disabled = false;
  }
}

function clearQwenReview() {
  if (!qwenReviewTerminal) return;

  qwenReviewTerminal.clear();
  setReviewOutputKind("");
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

  void refreshQwenHealth().catch(console.error);

  elements.qwenHealthButton?.addEventListener("click", () => {
    void refreshQwenHealth().catch(console.error);
  });
  elements.qwenLoadBadSampleButton?.addEventListener("click", () => loadBadSample());
  elements.qwenReviewButton?.addEventListener("click", () => {
    void runQwenReview().catch(console.error);
  });
  elements.qwenClearButton?.addEventListener("click", () => clearQwenReview());
  elements.qwenCodeInput?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void runQwenReview().catch(console.error);
    }
  });
}
