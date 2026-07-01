import { getSteamPresence } from "./api.js";
import { escapeHtml } from "./markdown.js";
import { elements } from "./ui.js";

const STEAM_PRESENCE_REFRESH_MS = 60_000;
let isRefreshingSteamPresence = false;
let steamRefreshIntervalId = null;

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
    const detail = escapeHtml(presence?.error || "Steam privacy settings or the Web API may be hiding activity.");
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

  const actorName = escapeHtml(presence.personaName || "Steam profile");
  const statusText = escapeHtml(presence.statusText || "Unknown");

  if (presence.isInGame) {
    const gameName = escapeHtml(presence.gameName || presence.gameId || "Unknown Game");

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

  const state = presence.isOnline ? "online" : "offline";
  const summary = presence.isOnline
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

export async function refreshSteamPresence() {
  if (isRefreshingSteamPresence || !elements.steamPresence) return;

  isRefreshingSteamPresence = true;

  try {
    renderSteamPresenceLoading();
    const presence = await getSteamPresence();
    renderSteamPresenceBadge(presence);
  } finally {
    isRefreshingSteamPresence = false;
  }
}

export function initSteamPresence() {
  if (!elements.steamPresence) return;

  refreshSteamPresence().catch(console.error);

  if (steamRefreshIntervalId !== null) {
    clearInterval(steamRefreshIntervalId);
  }

  steamRefreshIntervalId = setInterval(() => {
    refreshSteamPresence().catch(console.error);
  }, STEAM_PRESENCE_REFRESH_MS);
}
