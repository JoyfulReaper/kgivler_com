import { Commands } from "./commands.js";
import { elements, Terminal, createTerminalContext, initHostTelemetry } from "./ui.js";
import { getSystemData, getWorkstationStatus, fetchRandomGame } from "./api.js";
import { initQwenPanel } from "./qwen-panel.js";
import { parseCommandLine } from "./parser.js";
import { initSteamPresence, refreshSteamPresence } from "./steam.js";
import { initGitActivity } from "./git-activity.js";
import { initQotd } from "./qotd.js";

const demoTerminal = createTerminalContext(elements.demo);

async function runRandomGameDemo() {
  const randomButton = document.getElementById("btn-random-game");
  const steamInput = document.getElementById("demoSteamInput");

  if (!randomButton || !steamInput) return;

  randomButton.disabled = true;

  try {
    await fetchRandomGame(steamInput.value.trim(), demoTerminal);
  } finally {
    randomButton.disabled = false;
  }
}

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
      error.className = "widget-state-unavailable";
      error.textContent = `[UNAVAILABLE] ${data?.error || "Workstation telemetry is temporarily unavailable."}`;

      const detail = document.createElement("div");
      detail.className = "widget-state-detail";
      detail.textContent = "Only this optional widget is affected. Use Refresh Telemetry to try again.";

      elements.telemetry.replaceChildren(error, detail);
      return;
    }

    initHostTelemetry(data);
  } catch (error) {
    console.error("Workstation telemetry refresh failed:", error);
    initHostTelemetry(null);
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
  getSystemData()
    .then(initHostTelemetry)
    .catch((error) => {
      console.error("Initial workstation telemetry failed:", error);
      initHostTelemetry(null);
    });
  initSteamPresence();
  initGitActivity();
  initQotd();
  initQwenPanel();
  elements.workstationRefreshButton?.addEventListener("click", () => refreshWorkstation());
  elements.steamRefreshButton?.addEventListener("click", () => {
    void refreshSteamPresence({ showLoading: true });
  });

  // Terminal input listener
  elements.input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") processCommand(elements.input.value.trim());
  });

  // Steam widget button
  const randomBtn = document.getElementById("btn-random-game");
  if (randomBtn) {
    randomBtn.addEventListener("click", () => {
      void runRandomGameDemo();
    });
  }

  document.getElementById("demoSteamInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runRandomGameDemo();
    }
  });

});
