import { Commands } from "./commands.js";
import { elements, Terminal, initHostTelemetry } from "./ui.js";
import { getSystemData, getWorkstationStatus, fetchRandomGame } from "./api.js";
import { initQwenPanel } from "./qwen-panel.js";
import { parseCommandLine } from "./parser.js";
import { initSteamPresence, refreshSteamPresence } from "./steam.js";
import { initGitActivity } from "./git-activity.js";
import { initQotd } from "./qotd.js";

// Helper to create UI-agnostic terminal contexts
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

const demoTerminal = createTerminalContext(elements.demo);

async function refreshWorkstation() {
  if (!elements.workstationRefreshButton || !elements.telemetry) return;

  elements.workstationRefreshButton.disabled = true;
  elements.telemetry.innerHTML = `<div class="text-warning animate-pulse"><i class="fas fa-spinner fa-spin me-2"></i>Refreshing telemetry...</div>`;

  try {
    const data = await getWorkstationStatus();

    if (!data || data.ok === false) {
      elements.telemetry.innerHTML = `<div class="text-danger">[OFFLINE] ${data?.error || "Workstation refresh failed."}</div>`;
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
    if (Commands[cmd]) {
      await Commands[cmd](args, Terminal);
    } else {
      Terminal.error(`bash: command not found: ${cmd}`);
    }
  } catch (err) {
    console.error(`Execution error in ${cmd}:`, err);
    Terminal.error(`[CRITICAL] Error executing command: ${cmd}`);
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
  elements.steamRefreshButton?.addEventListener("click", () => refreshSteamPresence().catch(console.error));

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
