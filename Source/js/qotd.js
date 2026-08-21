import { getQuoteOfTheDay } from "./api.js";
import { escapeHtml } from "./markdown.js";
import { elements } from "./ui.js";

let isRefreshingQotd = false;

function renderLoading() {
  if (!elements.qotdOutput) return;

  elements.qotdOutput.innerHTML = `
    <div class="text-warning animate-pulse">
      <i class="fas fa-spinner fa-spin me-2"></i>
      Fetching today's quote...
    </div>`;
}

function renderError(message) {
  if (!elements.qotdOutput) return;

  const unavailable = document.createElement("div");
  unavailable.className = "widget-state-unavailable";
  unavailable.textContent = `[UNAVAILABLE] ${message}`;

  const detail = document.createElement("div");
  detail.className = "widget-state-detail";
  detail.textContent = "Only the Quote of the Day service is affected. Use Refresh Quote to retry.";

  elements.qotdOutput.replaceChildren(unavailable, detail);
}

function renderQuote(quote) {
  if (!elements.qotdOutput) return;

  const text = escapeHtml(
    typeof quote?.text === "string" && quote.text.trim()
      ? quote.text
      : "No quote is available today."
  );
  const author = escapeHtml(
    typeof quote?.author === "string" && quote.author.trim()
      ? quote.author
      : "Unknown author"
  );
  const source =
    typeof quote?.source === "string" && quote.source.trim()
    ? escapeHtml(quote.source)
    : null;

  elements.qotdOutput.innerHTML = `
    <div class="qotd-meta mb-2">[HAPPYQOTD] Daily selection loaded</div>
    <div class="qotd-quote-text">"${text}"</div>
    <div class="qotd-attribution mt-2">
      <span>-- ${author}</span>
      ${source ? `<span class="text-muted"> | ${source}</span>` : ""}
    </div>`;
}

export async function refreshQotd() {
  if (isRefreshingQotd || !elements.qotdOutput) {
    return;
  }

  isRefreshingQotd = true;

  if (elements.qotdRefreshButton) {
    elements.qotdRefreshButton.disabled = true;
  }

  renderLoading();

  try {
    const result = await getQuoteOfTheDay();

    if (!result.ok) {
      renderError(result.error || "Quote of the day is unavailable.");
      return;
    }

    renderQuote(result.quote);
  } catch (error) {
    console.error("Quote of the Day refresh failed:", error);
    renderError("Quote of the Day is temporarily unavailable.");
  } finally {
    isRefreshingQotd = false;

    if (elements.qotdRefreshButton) {
      elements.qotdRefreshButton.disabled = false;
    }
  }
}

export function initQotd() {
  if (!elements.qotdOutput) return;

  elements.qotdRefreshButton?.addEventListener("click", () => {
    void refreshQotd();
  });

  void refreshQotd();
}
