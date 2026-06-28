import { API_CONFIG } from "./config.js";

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

export async function fetchRandomGame(input, ctx) {
  if (!input) input = "Mister_God";

  ctx.loading('Connecting to Steam...');

  try {
    const response = await fetch(`${API_CONFIG.STEAM}/api/Steam/RandomGameByVanityUrl/${encodeURIComponent(input)}`);

    if (response.status === 429) {
      ctx.error('<span class="text-danger">[ERROR] 429: Too many requests. Please slow down and try again in a moment.</span>');
      return;
    }

    if (!response.ok) {
      let errorDetail = "Could not resolve account or fetch games.";
      try {
        const problemJson = await response.json();
        errorDetail = problemJson.title || problemJson.detail || errorDetail;
      } catch (_) {}
      ctx.error(`<span class="text-danger">[ERROR] ${errorDetail}</span>`);
      return;
    }

    const data = await response.json();
    const target = data.data || data.value || data;
    const gameName = target.name || target.Name;
    const appId = target.Id || target.id || target.appId || target.AppId;

    if (!gameName) {
      ctx.error('<span class="text-danger">[ERROR] Account has no games or the profile/library is private.</span>');
      return;
    }

    ctx.print(`[SUCCESS] Game Selected: <strong>${gameName}</strong> <br /><small>AppID: ${appId}</small>`);
  } catch (err) {
    ctx.error('<span class="text-danger">[ERROR] Network error: Could not reach the API server.</span>');
  }
}
