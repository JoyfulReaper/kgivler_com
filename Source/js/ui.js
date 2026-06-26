export const elements = {
    input: document.getElementById('terminalCommandInput'),
    output: document.getElementById('terminal-output'),
    demo: document.getElementById('demo-output'),
    telemetry: document.getElementById('host-telemetry')
}

export const render = (html) => { elements.output.innerHTML = html; };
export const showError = (msg) => { render(`<span class="text-danger">${msg}</span>`); };
export const showLoading = (msg) => { render(`<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i>${msg}</span>`); };

export function initHostTelemetry(data) {
        if (!elements.telemetry) return;
    
    if (!data) {
        elements.telemetry.innerHTML = `<div class="text-danger">[OFFLINE]</div>`;
        return;
    }

    const formattedStorage = data.storage.toString().replace(/[\d.]+/, match => parseFloat(match).toFixed(2));
    elements.telemetry.classList.remove('d-none');
    
    const gpuText = data.gpu.name 
        ? `${data.gpu.name} | Load: ${data.gpu.loadPercentage}% | VRAM: ${data.gpu.vramUsedMB}/${data.gpu.vramTotalMB}MB`
        : (data.gpu.error || data.gpu);
    
    elements.telemetry.innerHTML = `
        <div class="row g-0 g-md-3 font-monospace" style="color: #e2e8f0; font-size: 0.9rem;">
            <div class="col-md-6">
                <div><span style="color: #38bdf8;"><i class="fab fa-windows me-2"></i>Host System:</span> ${data.os} (${data.architecture})</div>
                <div><span style="color: #38bdf8;"><i class="fas fa-microchip me-2"></i>CPU Load:</span> ${data.cpuUsage} <small class="text-muted">(${data.cpuCores} Cores)</small></div>
                <div><span style="color: #38bdf8;"><i class="fas fa-memory me-2"></i>System RAM:</span> ${data.ram}</div>
                <div><span style="color: #38bdf8;"><i class="fas fa-desktop me-2"></i>Graphics:</span> ${gpuText}</div>
            </div>
            <div class="col-md-6">
                <div><span style="color: #38bdf8;"><i class="fas fa-clock me-2"></i>Node Uptime:</span> ${data.uptime}</div>
                <div><span style="color: #38bdf8;"><i class="fas fa-database me-2"></i>Root Volume:</span> ${formattedStorage}</div>
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