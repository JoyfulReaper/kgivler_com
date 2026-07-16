import { getSteamPresence } from "./api.js";
import { escapeHtml } from "./markdown.js";
import { elements } from "./ui.js";

const STEAM_PRESENCE_REFRESH_MS = 60_000;
let steamRefreshIntervalId = null;
let hasInitializedSteamPresence = false;
let steamPresenceRequest = null;

function renderSteamPresenceLoading() {
  if (!elements.steamPresence) return;

  elements.steamPresence.innerHTML = `
    <div class="text-warning animate-pulse">
      <i class="fab fa-steam me-2"></i>
      Checking Steam presence...
    </div>`;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPresenceObject(presence) {
  return (
    presence !== null &&
    typeof presence === "object" &&
    !Array.isArray(presence)
  );
}

function hasUsablePresenceShape(presence) {
  return (
    typeof presence.isInGame === "boolean" ||
    typeof presence.isOnline === "boolean" ||
    isNonEmptyString(presence.personaName) ||
    isNonEmptyString(presence.statusText) ||
    isNonEmptyString(presence.gameName) ||
    isNonEmptyString(presence.gameId)
  );
}

function renderSteamPresenceUnavailable(detail) {
  if (!elements.steamPresence) return;

  const safeDetail = escapeHtml(
    isNonEmptyString(detail)
      ? detail
      : "Steam privacy settings or the Web API may be hiding activity."
  );

  elements.steamPresence.innerHTML = `
      <div class="steam-presence-line">
        <span class="steam-presence-pill" data-state="unavailable">
          <i class="fab fa-steam"></i>
          unavailable
        </span>
        <span><strong>[STEAM]</strong> Status unavailable</span>
      </div>
      <div class="text-muted small mt-1">${safeDetail}</div>`;
}

function renderSteamPresenceBadge(presence) {
  if (!elements.steamPresence) return;

  if (!isPresenceObject(presence)) {
    renderSteamPresenceUnavailable();
    return;
  }

  if (presence.ok === false) {
    renderSteamPresenceUnavailable(presence.error);
    return;
  }

  if (!hasUsablePresenceShape(presence)) {
    renderSteamPresenceUnavailable("Steam presence response was malformed.");
    return;
  }

  const actorName = escapeHtml(
    isNonEmptyString(presence.personaName)
      ? presence.personaName
      : "Steam profile"
  );
  const statusText = escapeHtml(
    isNonEmptyString(presence.statusText)
      ? presence.statusText
      : "Unknown"
  );

  if (presence.isInGame === true) {
    const gameName = escapeHtml(
      isNonEmptyString(presence.gameName)
        ? presence.gameName
        : isNonEmptyString(presence.gameId)
          ? presence.gameId
          : "Unknown Game"
    );

    elements.steamPresence.innerHTML = `
      <div class="steam-presence-line">
        <span class="steam-presence-pill" data-state="in-game">
          <i class="fab fa-steam"></i>
          in-game
        </span>
        <span><strong>[STEAM]</strong> ${actorName} is in-game: ${gameName}</span>
      </div>
      <div class="text-warning small mt-1">[NOTICE] Local AI review may be unavailable while the workstation is busy.</div>`;
    return;
  }

  const state = presence.isOnline === true ? "online" : "offline";
  const summary = presence.isOnline === true
    ? `${actorName} is online`
    : `${actorName} is offline`;

  elements.steamPresence.innerHTML = `
    <div class="steam-presence-line">
      <span class="steam-presence-pill" data-state="${state}">
        <i class="fab fa-steam"></i>
        ${statusText.toLowerCase()}
      </span>
      <span><strong>[STEAM]</strong> ${summary}</span>
    </div>`;
}

async function loadSteamPresence(options = {}) {
  const { showLoading = false } = options;

  if (elements.steamRefreshButton) {
    elements.steamRefreshButton.disabled = true;
  }

  try {
    if (showLoading) {
      renderSteamPresenceLoading();
    }

    const presence = await getSteamPresence();
    renderSteamPresenceBadge(presence);
  } finally {
    if (elements.steamRefreshButton) {
      elements.steamRefreshButton.disabled = false;
    }
  }
}

export function refreshSteamPresence(options = {}) {
  if (!elements.steamPresence) {
    return Promise.resolve();
  }

  if (steamPresenceRequest) {
    return steamPresenceRequest;
  }

  steamPresenceRequest = loadSteamPresence(options)
    .finally(() => {
      steamPresenceRequest = null;
    });

  return steamPresenceRequest;
}

function startSteamPresencePolling() {
  if (steamRefreshIntervalId !== null) {
    return;
  }

  steamRefreshIntervalId = setInterval(() => {
    void refreshSteamPresence({ showLoading: false }).catch(console.error);
  }, STEAM_PRESENCE_REFRESH_MS);
}

function stopSteamPresencePolling() {
  if (steamRefreshIntervalId === null) {
    return;
  }

  clearInterval(steamRefreshIntervalId);
  steamRefreshIntervalId = null;
}

async function refreshSteamAfterPageRestore() {
  const previousRequest = steamPresenceRequest;

  if (previousRequest) {
    await previousRequest;
  }

  await refreshSteamPresence({ showLoading: false });
}

export function initSteamPresence() {
  if (!elements.steamPresence) return;

  void refreshSteamPresence({ showLoading: true }).catch(console.error);
  startSteamPresencePolling();

  if (hasInitializedSteamPresence) {
    return;
  }

  hasInitializedSteamPresence = true;

  window.addEventListener("pagehide", () => {
    stopSteamPresencePolling();
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) {
      return;
    }

    startSteamPresencePolling();
    void refreshSteamAfterPageRestore().catch((error) => {
      console.error(
        "Unable to refresh restored Steam presence.",
        error
      );
    });
  });
}
