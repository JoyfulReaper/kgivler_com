import { getSteamPresence } from "./api.js";
import { escapeHtml } from "./markdown.js";
import { elements } from "./ui.js";

const STEAM_PRESENCE_REFRESH_MS = 60_000;
let isRefreshingSteamPresence = false;
let steamRefreshIntervalId = null;
let hasInitializedSteamPresence = false;

function renderSteamPresenceLoading() {
  if (!elements.steamPresence) return;

  elements.steamPresence.innerHTML = `
    <div class="text-warning animate-pulse">
      <i class="fab fa-steam me-2"></i>
      Checking Steam presence...
    </div>`;
}

function renderSteamPresenceBadge(presence) {
  if (!elements.steamPresence) return;

  if (!presence || presence.ok === false) {
    const detail = escapeHtml(
      typeof presence?.error === "string" && presence.error.trim()
        ? presence.error
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
      <div class="text-muted small mt-1">${detail}</div>`;
    return;
  }

  const actorName = escapeHtml(
    typeof presence.personaName === "string" && presence.personaName.trim()
      ? presence.personaName
      : "Steam profile"
  );
  const statusText = escapeHtml(
    typeof presence.statusText === "string" && presence.statusText.trim()
      ? presence.statusText
      : "Unknown"
  );

  if (presence.isInGame === true) {
    const gameName = escapeHtml(
      typeof presence.gameName === "string" && presence.gameName.trim()
        ? presence.gameName
        : typeof presence.gameId === "string" && presence.gameId.trim()
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

export async function refreshSteamPresence(options = {}) {
  if (isRefreshingSteamPresence || !elements.steamPresence) return;

  const { showLoading = false } = options;
  isRefreshingSteamPresence = true;

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
    isRefreshingSteamPresence = false;

    if (elements.steamRefreshButton) {
      elements.steamRefreshButton.disabled = false;
    }
  }
}

function startSteamPresencePolling() {
  if (steamRefreshIntervalId !== null) {
    return;
  }

  steamRefreshIntervalId = setInterval(() => {
    refreshSteamPresence({ showLoading: false }).catch(console.error);
  }, STEAM_PRESENCE_REFRESH_MS);
}

function stopSteamPresencePolling() {
  if (steamRefreshIntervalId === null) {
    return;
  }

  clearInterval(steamRefreshIntervalId);
  steamRefreshIntervalId = null;
}

export function initSteamPresence() {
  if (!elements.steamPresence) return;

  refreshSteamPresence({ showLoading: true }).catch(console.error);
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
    refreshSteamPresence({ showLoading: false }).catch(console.error);
  });
}
