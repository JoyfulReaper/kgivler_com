import { API_CONFIG } from "./config.js";

let isFetching = false;

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readProblemDetail(response, fallbackMessage) {
  try {
    const problemJson = await response.json();
    return problemJson.title || problemJson.detail || fallbackMessage;
  } catch (_) {
    return fallbackMessage;
  }
}

export async function getSystemData() {
  if (isFetching) return null;
  isFetching = true;

  try {
    const res = await fetchJsonWithTimeout(`${API_CONFIG.TELEMETRY}/api/system/usage`, {}, 5000);

    if (!res.ok) throw new Error("Request failed");
    return await res.json();
  } catch (e) {
    console.error("Fetch failed or timed out:", e);
    return null;
  } finally {
    isFetching = false;
  }
}

export async function getQwenCoderHealth() {
  try {
    const response = await fetchJsonWithTimeout(`${API_CONFIG.QWENCODER}/api/code-review/health`, {}, 5000);

    if (!response.ok) {
      const detail = await readProblemDetail(response, "QwenCoder health check failed.");
      return { ok: false, error: detail, status: response.status };
    }

    return await response.json();
  } catch (e) {
    console.error("QwenCoder health fetch failed or timed out:", e);
    return { ok: false, error: "Could not reach QwenCoder.", status: 0 };
  }
}

export async function getWorkstationStatus() {
  try {
    const response = await fetchJsonWithTimeout(`${API_CONFIG.TELEMETRY}/api/system/status`, {}, 5000);

    if (!response.ok) {
      const detail = await readProblemDetail(response, "Workstation refresh failed.");
      return { ok: false, error: detail, status: response.status };
    }

    return await response.json();
  } catch (e) {
    console.error("Workstation status fetch failed or timed out:", e);
    return { ok: false, error: "Could not reach the workstation status endpoint.", status: 0 };
  }
}

export async function getSteamPresence() {
  try {
    const response = await fetchJsonWithTimeout(`${API_CONFIG.TELEMETRY}/api/steam/presence`, {}, 5000);

    if (!response.ok) {
      const detail = await readProblemDetail(response, "Steam presence check failed.");
      return { ok: false, error: detail, status: response.status };
    }

    return await response.json();
  } catch (e) {
    console.error("Steam presence fetch failed or timed out:", e);
    return { ok: false, error: "Could not reach the Steam presence endpoint.", status: 0 };
  }
}

export async function submitQwenCoderReview(code, language = "auto") {
  const trimmedCode = (code || "").trim();
  if (!trimmedCode) {
    return { ok: false, error: "Paste some code first." };
  }

  try {
    const response = await fetchJsonWithTimeout(`${API_CONFIG.QWENCODER}/api/code-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: trimmedCode, language }),
    }, 90_000);

    if (!response.ok) {
      const detail = await readProblemDetail(response, "Code review failed.");
      return { ok: false, error: detail, status: response.status };
    }

    return await response.json();
  } catch (e) {
    console.error("QwenCoder review fetch failed or timed out:", e);
    return { ok: false, error: "Could not reach QwenCoder.", status: 0 };
  }
}

/**
 * @param {string} input - Vanity URL
 * @param {object} ctx - Context object with .loading(), .error(), .print()
 * @param {string} provider - Default "steam"
 */
export async function fetchRandomGame(input, ctx, provider = "steam") {
  if (!input) input = "Mister_God";

  ctx.loading(`Connecting to ${provider}...`);

  try {
    const response = await fetch(`${API_CONFIG.STEAM}/api/${provider}/random-game?vanityUrl=${encodeURIComponent(input)}`);

    if (response.status === 429) {
      ctx.error('<span class="text-danger">[ERROR] 429: Too many requests. Please slow down and try again in a few seconds.</span>');
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
    const gameName = data.appInformation?.name;
    const appId = data.appId;

    if (!gameName) {
      ctx.error('<span class="text-danger">[ERROR] Account has no games or the profile/library is private.</span>');
      return;
    }

    ctx.print(`[SUCCESS] Game Selected: <strong>${gameName}</strong> <br /><small>AppID: ${appId}</small>`);
  } catch (err) {
    console.error("Fetch Error:", err);
    ctx.error('<span class="text-danger">[ERROR] Network error: Could not reach the API server.</span>');
  }
}
