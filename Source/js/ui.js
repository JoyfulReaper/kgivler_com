import { escapeHtml } from "./markdown.js";

export const elements = {
  input: document.getElementById('terminalCommandInput'),
  output: document.getElementById('terminal-output'),
  demo: document.getElementById('demo-output'),
  telemetry: document.getElementById('host-telemetry'),
  steamPresence: document.getElementById('steam-presence'),
  qotdOutput: document.getElementById('qotd-output'),

  gitActivity: document.getElementById('recent-git-activity'),
  gitActivityRefreshButton: document.getElementById('btn-git-activity-refresh'),

  qwenReviewOutput: document.getElementById('qwen-review-output'),
  qwenHealthBadge: document.getElementById('qwen-health-badge'),
  qwenCodeInput: document.getElementById('qwenCodeInput'),
  qwenLanguage: document.getElementById('qwenLanguage'),
  qwenHealthButton: document.getElementById('btn-qwen-health'),
  qwenLoadBadSampleButton: document.getElementById('btn-load-bad-sample'),
  qwenReviewButton: document.getElementById('btn-qwen-review'),
  qwenClearButton: document.getElementById('btn-qwen-clear'),
  workstationRefreshButton: document.getElementById('btn-workstation-refresh'),
  steamRefreshButton: document.getElementById('btn-steam-refresh')
};

export function createTerminalContext(element) {
  return {
    printText(value) {
      if (!element) return;
      element.textContent = String(value ?? "");
    },
    printTrustedHtml(html) {
      if (!element) return;
      element.innerHTML = html;
    },
    errorText(message) {
      if (!element) return;

      const span = document.createElement("span");
      span.className = "text-danger";
      span.textContent = `[ERROR] ${message}`;
      element.replaceChildren(span);
    },
    loadingText(message) {
      if (!element) return;

      element.innerHTML =
        `<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i>${escapeHtml(message)}</span>`;
    },
    clear() {
      element?.replaceChildren();
    },
  };
}

export const Terminal =
  createTerminalContext(elements.output);

// --- PRIVATE HELPERS ---
const formatGpuData = (gpu) => {
  if (!gpu || typeof gpu !== "object") {
    return typeof gpu === "string"
      ? gpu
      : "Unknown";
  }

  if (gpu.name) {
    return `${gpu.name} | Load: ${gpu.loadPercentage ?? "?"}% | VRAM: ${gpu.vramUsedMB ?? "?"}/${gpu.vramTotalMB ?? "?"}MB`;
  }

  return gpu.error || "Unknown";
};

const formatStorage = (storage) => {
  if (storage === null || storage === undefined) {
    return "Unknown";
  }

  return String(storage).replace(/[\d.]+/, match => {
    const parsed = parseFloat(match);
    return Number.isFinite(parsed)
      ? parsed.toFixed(2)
      : match;
  });
};

const lastTelemetryCounters = {
  totalRequestsHandled: null,
  uniqueVisitors: null
};

export function initHostTelemetry(data) {
  if (!elements.telemetry) return;

  if (!data) {
    const offline = document.createElement("div");
    offline.className = "text-danger";
    offline.textContent = "[OFFLINE]";
    elements.telemetry.replaceChildren(offline);
    return;
  }

  elements.telemetry.classList.remove('d-none');

  if (data.totalRequestsHandled !== undefined && data.totalRequestsHandled !== null) {
    lastTelemetryCounters.totalRequestsHandled = data.totalRequestsHandled;
  }

  if (data.uniqueVisitors !== undefined && data.uniqueVisitors !== null) {
    lastTelemetryCounters.uniqueVisitors = data.uniqueVisitors;
  }

  const totalRequestsHandled = data.totalRequestsHandled ?? lastTelemetryCounters.totalRequestsHandled;
  const uniqueVisitors = data.uniqueVisitors ?? lastTelemetryCounters.uniqueVisitors;

  const wrapper = document.createElement("div");
  wrapper.className = "row g-0 g-md-3 font-monospace";
  wrapper.style.color = "#e2e8f0";
  wrapper.style.fontSize = "0.9rem";

  const left = document.createElement("div");
  left.className = "col-md-6";
  const right = document.createElement("div");
  right.className = "col-md-6";

  const addMetric = (parent, iconClass, label, value, suffix = "") => {
    const row = document.createElement("div");
    const labelSpan = document.createElement("span");
    labelSpan.style.color = "#38bdf8";
    labelSpan.innerHTML = `<i class="${iconClass} me-2"></i>${escapeHtml(label)}:`;

    row.append(labelSpan, ` ${String(value ?? "Unknown")}${suffix}`);
    parent.append(row);
  };

  addMetric(left, "fab fa-windows", "Host System", `${data.os ?? "Unknown"} (${data.architecture ?? "unknown"})`);
  addMetric(left, "fas fa-microchip", "CPU Load", data.cpuUsage ?? "Unknown", ` (${data.cpuCores ?? "?"} Cores)`);
  addMetric(left, "fas fa-memory", "System RAM", data.ram ?? "Unknown");
  addMetric(left, "fas fa-desktop", "Graphics", formatGpuData(data.gpu));
  addMetric(right, "fas fa-clock", "Node Uptime", data.uptime ?? "Unknown");
  addMetric(right, "fas fa-database", "Root Volume", formatStorage(data.storage));
  addMetric(right, "fas fa-tasks", "Kernel Tasks", `${data.processCount ?? "Unknown"} running PIDs`);
  addMetric(right, "fas fa-cloud-sun", "Environment", data.weather ?? "Unknown");

  const footer = document.createElement("div");
  footer.className = "col-12 mt-2 pt-2 border-top d-flex flex-column flex-sm-row justify-content-between gap-2";
  footer.style.borderColor = "#222226";
  footer.style.fontSize = "0.8rem";
  footer.style.color = "#888892";

  const stardate = document.createElement("span");
  stardate.textContent = `STARDATE: ${data.stardate ?? "Unknown"}`;
  const runtime = document.createElement("span");
  runtime.textContent = `RUNTIME: ${data.framework ?? "Unknown"}`;
  const hits = document.createElement("span");
  hits.textContent =
    totalRequestsHandled !== null && totalRequestsHandled !== undefined &&
    uniqueVisitors !== null && uniqueVisitors !== undefined
      ? `${totalRequestsHandled} Hits / ${uniqueVisitors} Unique`
      : "HIT COUNTER: unavailable";

  footer.append(stardate, runtime, hits);
  wrapper.append(left, right, footer);
  elements.telemetry.replaceChildren(wrapper);
}
