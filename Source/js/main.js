import { Commands } from "./commands.js";
import { elements, showError, initHostTelemetry } from "./ui.js";
import { getSystemData, fetchRandomGame } from "./api.js";
import { parseCommandLine } from "./parser.js";


async function processCommand(input) {
  if (!input) return;

  elements.input.value = "";

try {
    const [cmd, ...args] = parseCommandLine(input);

    if (!cmd) return;

    if (Commands[cmd]) {
      await Commands[cmd](args);
    } else {
      showError(`bash: command not found: ${cmd}`);
    }
  } catch (err) {
    console.error("Execution error:", err);
    showError(`Runtime error: ${err.message}`);
  } finally {
    elements.input.focus();
  }
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await getSystemData();
    initHostTelemetry(data);
  } catch (err) {
    console.error("Telemetry failed to init:", err);
  }

  // Terminal input listener
  if (elements.input) {
    elements.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") processCommand(elements.input.value.trim());
    });
  }

  // Steam widget button
  const randomBtn = document.getElementById("btn-random-game");
  if (randomBtn) {
    randomBtn.addEventListener("click", () => fetchRandomGame());
  }
});