import { Commands } from "./commands.js";
import { elements, showError, initHostTelemetry } from "./ui.js";
import { getSystemData, fetchRandomGame } from "./api.js";

async function processCommand(input) {
  if (!input) return;

  elements.input.value = "";

  const parts = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).map((arg) => arg.replace(/^["'](.*)["']$/, "$1"));

  if (Commands[cmd]) {
    await Commands[cmd](args);
  } else {
    showError(`Command not found: ${cmd}. Type 'help' for options.`);
  }
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
  const data = await getSystemData();
  initHostTelemetry(data);

  // Terminal input
  elements.input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") processCommand(elements.input.value.trim());
  });

  // steam widget run button
  const randomBtn = document.getElementById("btn-random-game");
  if (randomBtn) {
    randomBtn.addEventListener("click", () => fetchRandomGame());
  }
});
