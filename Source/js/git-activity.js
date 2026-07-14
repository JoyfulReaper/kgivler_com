import { getRecentGitActivity } from "./api.js";
import { elements } from "./ui.js";

let isRefreshingGitActivity = false;

function formatRepository(repository) {
  if (!repository) return "unknown";

  const parts = repository.split("/");
  return parts.at(-1) || repository;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function createActivityItem(item) {
  const container = document.createElement("div");
  container.className = "py-2 border-bottom";
  container.style.borderColor = "#222226";

  const commitLine = document.createElement("div");
  commitLine.className =
    "d-flex flex-column flex-lg-row gap-1 gap-lg-2 align-items-lg-baseline";

  const commitLink = document.createElement("a");
  commitLink.className = "font-monospace text-decoration-none";
  commitLink.href = item.url;
  commitLink.target = "_blank";
  commitLink.rel = "noopener noreferrer";
  commitLink.textContent = (item.sha || "unknown").slice(0, 7);

  const context = document.createElement("span");
  context.className = "text-accent font-monospace";
  context.textContent =
    `[${formatRepository(item.repository)}:${item.branch || "unknown"}]`;

  const message = document.createElement("span");
  message.textContent =
    item.message || "(no commit message)";

  commitLine.append(
    commitLink,
    context,
    message
  );

  const metadata = document.createElement("div");
  metadata.className = "small text-muted mt-1";
  metadata.textContent =
    `${item.author || item.authorUsername || "Unknown author"} · ` +
    formatTimestamp(item.timestamp);

  container.append(
    commitLine,
    metadata
  );

  return container;
}

function renderLoading() {
  if (!elements.gitActivity) return;

  elements.gitActivity.innerHTML = `
    <div class="text-warning animate-pulse">
      <i class="fas fa-spinner fa-spin me-2"></i>
      Reading Git activity...
    </div>`;
}

function renderError(message) {
  if (!elements.gitActivity) return;

  const error = document.createElement("div");
  error.className = "text-danger";
  error.textContent = `[OFFLINE] ${message}`;

  elements.gitActivity.replaceChildren(error);
}

function renderActivity(items) {
  if (!elements.gitActivity) return;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "text-muted";
    empty.textContent = "[INFO] No recent Git activity found.";

    elements.gitActivity.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of items) {
    fragment.append(createActivityItem(item));
  }

  elements.gitActivity.replaceChildren(fragment);
}

export async function refreshGitActivity() {
  if (
    isRefreshingGitActivity ||
    !elements.gitActivity
  ) {
    return;
  }

  isRefreshingGitActivity = true;

  if (elements.gitActivityRefreshButton) {
    elements.gitActivityRefreshButton.disabled = true;
  }

  renderLoading();

  try {
    const result = await getRecentGitActivity(5);

    if (!result.ok) {
      renderError(
        result.error || "Git activity is unavailable."
      );

      return;
    }

    renderActivity(result.items);
  } finally {
    isRefreshingGitActivity = false;

    if (elements.gitActivityRefreshButton) {
      elements.gitActivityRefreshButton.disabled = false;
    }
  }
}

export function initGitActivity() {
  if (!elements.gitActivity) return;

  elements.gitActivityRefreshButton?.addEventListener(
    "click",
    () => refreshGitActivity().catch(console.error)
  );

  refreshGitActivity().catch(console.error);
}