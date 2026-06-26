import { API_CONFIG } from "./config.js";
import { elements } from "./ui.js";

let isFetching = false;

export async function getSystemData() {
  if (isFetching) return null;

  isFetching = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${API_CONFIG.TELEMETRY}/api/system/usage`, {
      signal: controller.signal,
    });

    if (!res.ok) throw new Error("Request failed");
    return await res.json();
  } catch (e) {
    console.error("Fetch failed or timed out:", e);
    return null;
  } finally {
    clearTimeout(timeoutId);
    isFetching = false;
  }
}

export async function fetchRandomGame(vanityUrl) {
  // If vanityUrl is passed we are in the terminal. Otherwise demo input.
  let input = vanityUrl || document.getElementById("demoSteamInput")?.value.trim();
  const activeOutput = vanityUrl ? elements.output : elements.demo;

  if (!input) {
    input = "Mister_God";
    // activeOutput.innerHTML = '<span class="text-danger">[ERROR] Please provide a VanityURL.</span>';
    // return;
  }

  elements.output.innerHTML = "";
  elements.demo.innerHTML = "";

  activeOutput.innerHTML = '<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i>Connecting to Steam...</span>';

  try {
    const response = await fetch(`${API_CONFIG.STEAM}/api/Steam/RandomGameByVanityUrl/${encodeURIComponent(input)}`);

    if (response.status === 429) {
      activeOutput.innerHTML = '<span class="text-danger">[ERROR] 429: Too many requests. Please slow down and try again in a moment.</span>';
      return;
    }

    if (!response.ok) {
      let errorDetail = "Could not resolve account or fetch games.";
      try {
        const problemJson = await response.json();
        errorDetail = problemJson.title || problemJson.detail || errorDetail;
      } catch (_) {}
      activeOutput.innerHTML = `<span class="text-danger">[ERROR] ${errorDetail}</span>`;
      return;
    }

    const data = await response.json();
    const target = data.data || data.value || data;
    const gameName = target.name || target.Name;
    const appId = target.Id || target.id || target.appId || target.AppId;

    if (!gameName) {
      activeOutput.innerHTML = '<span class="text-danger">[ERROR] Account has no games or the profile/library is private.</span>';
      return;
    }

    activeOutput.innerHTML = `[SUCCESS] Game Selected: <strong>${gameName}</strong> <br /><small>AppID: ${appId}</small>`;
  } catch (err) {
    activeOutput.innerHTML = '<span class="text-danger">[ERROR] Network error: Could not reach the API server.</span>';
  }
}
