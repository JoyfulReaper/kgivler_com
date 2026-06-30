export const elements = {
  input: document.getElementById('terminalCommandInput'),
  output: document.getElementById('terminal-output'),
  demo: document.getElementById('demo-output'),
  telemetry: document.getElementById('host-telemetry'),
  qwenReviewOutput: document.getElementById('qwen-review-output'),
  qwenHealthBadge: document.getElementById('qwen-health-badge'),
  qwenCodeInput: document.getElementById('qwenCodeInput'),
  qwenLanguage: document.getElementById('qwenLanguage'),
  qwenHealthButton: document.getElementById('btn-qwen-health'),
  qwenReviewButton: document.getElementById('btn-qwen-review'),
  qwenClearButton: document.getElementById('btn-qwen-clear')
};

export const Terminal = {
  print: (html) => { 
    if (elements.output) elements.output.innerHTML = html; 
  },
  error: (msg) => { 
    Terminal.print(`<span class="text-danger">[ERROR] ${msg}</span>`); 
  },
  loading: (msg) => { 
    Terminal.print(`<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i>${msg}</span>`); 
  },
  clear: () => { 
    if (elements.output) elements.output.innerHTML = ""; 
  }
};

// --- PRIVATE HELPERS ---
const formatGpuData = (gpu) => {
  if (gpu.name) return `${gpu.name} | Load: ${gpu.loadPercentage}% | VRAM: ${gpu.vramUsedMB}/${gpu.vramTotalMB}MB`;
  return gpu.error || gpu || "Unknown";
};

const formatStorage = (storage) => {
  return storage.toString().replace(/[\d.]+/, match => parseFloat(match).toFixed(2));
};

export function initHostTelemetry(data) {
  if (!elements.telemetry) return;

  if (!data) {
    elements.telemetry.innerHTML = `<div class="text-danger">[OFFLINE]</div>`;
    return;
  }

  elements.telemetry.classList.remove('d-none');
  elements.telemetry.innerHTML = `
    <div class="row g-0 g-md-3 font-monospace" style="color: #e2e8f0; font-size: 0.9rem;">
        <div class="col-md-6">
            <div><span style="color: #38bdf8;"><i class="fab fa-windows me-2"></i>Host System:</span> ${data.os} (${data.architecture})</div>
            <div><span style="color: #38bdf8;"><i class="fas fa-microchip me-2"></i>CPU Load:</span> ${data.cpuUsage} <small class="text-muted">(${data.cpuCores} Cores)</small></div>
            <div><span style="color: #38bdf8;"><i class="fas fa-memory me-2"></i>System RAM:</span> ${data.ram}</div>
            <div><span style="color: #38bdf8;"><i class="fas fa-desktop me-2"></i>Graphics:</span> ${formatGpuData(data.gpu)}</div>
        </div>
        <div class="col-md-6">
            <div><span style="color: #38bdf8;"><i class="fas fa-clock me-2"></i>Node Uptime:</span> ${data.uptime}</div>
            <div><span style="color: #38bdf8;"><i class="fas fa-database me-2"></i>Root Volume:</span> ${formatStorage(data.storage)}</div>
            <div><span style="color: #38bdf8;"><i class="fas fa-tasks me-2"></i>Kernel Tasks:</span> ${data.processCount} running PIDs</div>
            <div><span style="color: #38bdf8;"><i class="fas fa-cloud-sun me-2"></i>Environment:</span> ${data.weather}</div>
        </div>
        <div class="col-12 mt-2 pt-2 border-top d-flex flex-column flex-sm-row justify-content-between gap-2" style="border-color: #222226 !important; font-size: 0.8rem; color: #888892;">
            <span>STARDATE: ${data.stardate}</span>
            <span>RUNTIME: ${data.framework}</span>
            <span>${data.totalRequestsHandled} Hits / ${data.uniqueVisitors} Unique</span>
        </div>
    </div>`;
}
