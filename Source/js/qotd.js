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

  elements.qotdOutput.innerHTML = `
    <div class="text-danger">[ERROR] ${escapeHtml(message)}</div>
    <div class="small text-muted mt-1">This can also happen if the browser blocks the API response because of cross-origin policy.</div>`;
}

function renderQuote(quote) {
  if (!elements.qotdOutput) return;

  const text = escapeHtml(quote?.text || "No quote is available today.");
  const author = escapeHtml(quote?.author || "Unknown author");
  const source = quote?.source
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

  renderLoading();

  try {
    const result = await getQuoteOfTheDay();

    if (!result.ok) {
      renderError(result.error || "Quote of the day is unavailable.");
      return;
    }

    renderQuote(result.quote);
  } finally {
    isRefreshingQotd = false;
  }
}

export function initQotd() {
  if (!elements.qotdOutput) return;

  refreshQotd().catch(console.error);
}
