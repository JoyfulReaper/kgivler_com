import { Commands } from "./commands.js";
import { elements, Terminal, createTerminalContext, initHostTelemetry } from "./ui.js";
import { getSystemData, getWorkstationStatus, fetchRandomGame } from "./api.js";
import { initQwenPanel } from "./qwen-panel.js";
import { parseCommandLine } from "./parser.js";
import { initSteamPresence, refreshSteamPresence } from "./steam.js";
import { initGitActivity } from "./git-activity.js";
import { initQotd } from "./qotd.js";

const demoTerminal = createTerminalContext(elements.demo);

async function refreshWorkstation() {
  if (!elements.workstationRefreshButton || !elements.telemetry) return;

  elements.workstationRefreshButton.disabled = true;
  const loading = document.createElement("div");
  loading.className = "text-warning animate-pulse";
  loading.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>Refreshing telemetry...`;
  elements.telemetry.replaceChildren(loading);

  try {
    const data = await getWorkstationStatus();

    if (!data || data.ok === false) {
      const error = document.createElement("div");
      error.className = "text-danger";
      error.textContent = `[OFFLINE] ${data?.error || "Workstation refresh failed."}`;
      elements.telemetry.replaceChildren(error);
      return;
    }

    initHostTelemetry(data);
  } finally {
    elements.workstationRefreshButton.disabled = false;
  }
}

async function processCommand(input) {
  if (!input) return;
  elements.input.value = "";

  const [cmd, ...args] = parseCommandLine(input);

  try {
    const command =
      Object.hasOwn(Commands, cmd)
        ? Commands[cmd]
        : null;

    if (typeof command === "function") {
      await command(args, Terminal);
    } else {
      Terminal.errorText(`bash: command not found: ${cmd}`);
    }
  } catch (err) {
    console.error(`Execution error in ${cmd}:`, err);
    Terminal.errorText(`[CRITICAL] Error executing command: ${cmd}`);
  }
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  // Telemetry
  getSystemData().then(initHostTelemetry).catch(console.error);
  initSteamPresence();
  initGitActivity();
  initQotd();
  initQwenPanel();
  elements.workstationRefreshButton?.addEventListener("click", () => refreshWorkstation());
  elements.steamRefreshButton?.addEventListener("click", () => refreshSteamPresence({ showLoading: true }).catch(console.error));

  // Terminal input listener
  elements.input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") processCommand(elements.input.value.trim());
  });

  // Steam widget button
  const randomBtn = document.getElementById("btn-random-game");
  if (randomBtn) {
    randomBtn.addEventListener("click", () => {
      const input = document.getElementById("demoSteamInput")?.value.trim();
      fetchRandomGame(input, demoTerminal);
    });
  }

});
