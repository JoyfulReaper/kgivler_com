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

export async function getRecentGitActivity(limit = 5) {
  const effectiveLimit = Math.min(
    Math.max(Number(limit) || 5, 1),
    20
  );

  try {
    const response = await fetchJsonWithTimeout(
      `${API_CONFIG.GIT_ACTIVITY}/api/github/activity?limit=${effectiveLimit}`,
      {},
      5000
    );

    if (!response.ok) {
      const detail = await readProblemDetail(
        response,
        "Git activity request failed."
      );

      return {
        ok: false,
        error: detail,
        status: response.status,
      };
    }

    const activity = await response.json();

    return {
      ok: true,
      items: Array.isArray(activity) ? activity : [],
    };
  } catch (error) {
    console.error(
      "Git activity fetch failed or timed out:",
      error
    );

    return {
      ok: false,
      error: "Could not reach the Git activity endpoint.",
      status: 0,
    };
  }
}

function parseSteamIdentityInput(input) {
  const trimmed = (input || "").trim();

  if (!trimmed) {
    return { vanityUrl: "Mister_God" };
  }

  if (/^\d{17}$/.test(trimmed)) {
    return { userId: trimmed };
  }

  try {
    const normalizedUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    const parsed = new URL(normalizedUrl);
    const segments = parsed.pathname
      .split("/")
      .filter(Boolean);

    if (segments.length >= 2) {
      if (segments[0].toLowerCase() === "profiles" && /^\d{17}$/.test(segments[1])) {
        return { userId: segments[1] };
      }

      if (segments[0].toLowerCase() === "id" && segments[1]) {
        return { vanityUrl: segments[1] };
      }
    }
  } catch (_) {
    // Fall back to treating the input as a vanity URL slug.
  }

  return { vanityUrl: trimmed };
}

/**
 * @param {string} input - Steam vanity URL, 17-digit Steam ID, or Steam profile URL
 * @param {object} ctx - Context object with .loading(), .error(), .print()
 * @param {string} provider - Default "steam"
 */
export async function fetchRandomGame(input, ctx, provider = "steam") {
  const identity = parseSteamIdentityInput(input);
  const query = new URLSearchParams(identity);

  ctx.loading(`Connecting to ${provider}...`);

  try {
    const response = await fetchJsonWithTimeout(
      `${API_CONFIG.STEAM}/api/${provider}/random-game/details?${query.toString()}`,
      {},
      10000
    );

    if (response.status === 429) {
      ctx.error('<span class="text-danger">[ERROR] 429: Too many requests. Please slow down and try again in a few seconds.</span>');
      return;
    }

    if (!response.ok) {
      const errorDetail = await readProblemDetail(
        response,
        "Could not resolve account or fetch games."
      );

      ctx.error(`<span class="text-danger">[ERROR] ${errorDetail}</span>`);
      return;
    }

    const data = await response.json();
    const gameName = data?.name;
    const appId = data?.id;
    const playtimeHours =
      Number.isFinite(data?.playtimeForever)
        ? (data.playtimeForever / 60).toFixed(1)
        : null;

    if (!gameName) {
      ctx.error('<span class="text-danger">[ERROR] Account has no games or the profile/library is private.</span>');
      return;
    }

    ctx.print(
      `[SUCCESS] Game Selected: <strong>${gameName}</strong>` +
      ` <br /><small>AppID: ${appId}</small>` +
      (playtimeHours !== null
        ? ` <br /><small>Playtime: ${playtimeHours} hours</small>`
        : "")
    );
  } catch (err) {
    console.error("Fetch Error:", err);
    ctx.error('<span class="text-danger">[ERROR] Network error: Could not reach the API server.</span>');
  }
}
