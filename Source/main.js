// --- ENVIRONMENT CONFIGURATION ---
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const TELEMETRY_API_BASE = IS_LOCAL ? 'http://localhost:5081' : 'https://api.kgivler.com'; 
const STEAM_API_BASE = IS_LOCAL ? 'http://localhost:5281' : 'https://randomsteam.kgivler.com';
// ---------------------------------

// DOM Elements
const terminalInput = document.getElementById('terminalCommandInput');
const terminalOutput = document.getElementById('terminal-output');
const demoOutput = document.getElementById('demo-output');
const hostTelemetry = document.getElementById('host-telemetry');

// trigger telemetry pull when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initHostTelemetry();

    // input event listener
    if (terminalInput) {
        terminalInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                processCommand(terminalInput.value.trim());
            }
        });
    }
});

async function processCommand(input) {
    if (!input) return;

    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    
    if (terminalInput) {
        terminalInput.value = '';
    }

    switch (cmd) {
        case 'help':
            terminalOutput.innerHTML = `[INFO] Available commands: random [vanity], clear, cowsay, stats`;
            break;
        case 'clear':
            terminalOutput.innerHTML = '';
            demoOutput.innerHTML = '';
            break;
        case 'random':
            fetchRandomGame(parts[1]);
            break;
        case 'cowsay':
            terminalOutput.innerHTML = `<pre>
  ^__^
  (oo)\\_______
  (__)\\       )\\/\\
      ||----w |
      ||     ||
            </pre>`;
            break;
        case 'stats':
            terminalOutput.innerHTML =
                '<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i>Polling host engine...</span>';

            try {
                const res = await fetch(`${TELEMETRY_API_BASE}/api/system/usage`);
                if (!res.ok) throw new Error();

                const d = await res.json();

                terminalOutput.innerHTML = `
<pre style="color: #38bdf8; font-family: monospace; line-height: 1.4; margin: 0;">
<span style="color: #39ff14; font-weight: bold;">kyle@kgivler</span>
------------
<span style="color: #ffffff;">OS:</span>        ${d.os}
<span style="color: #ffffff;">Arch:</span>      ${d.architecture}
<span style="color: #ffffff;">Runtime:</span>   ${d.framework}
<span style="color: #ffffff;">Uptime:</span>    ${d.uptime}
<span style="color: #ffffff;">Host CPU:</span>  ${d.cpuUsage}
<span style="color: #ffffff;">Tasks:</span>     ${d.processCount}
<span style="color: #ffffff;">RAM:</span>       ${d.ram}
<span style="color: #ffffff;">GPU:</span>       ${d.gpu}
<span style="color: #ffffff;">Storage:</span>   ${d.storage}
<span style="color: #ffffff;">Stardate:</span>  ${d.stardate}
<span style="color: #ffffff;">Weather:</span>   ${d.weather}
<span style="color: #ffffff;">Traffic:</span>   ${d.totalRequestsHandled}
</pre>`;

                await initHostTelemetry();
            }
            catch {
                terminalOutput.innerHTML =
                    '<span class="text-danger">[ERROR] Command execution faulted.</span>';
            }
            break;
        default:
            terminalOutput.innerHTML = `[ERROR] Command not found: ${cmd}. Type 'help' for options.`;
    }
}


async function initHostTelemetry() {
    if (!hostTelemetry) return;
    hostTelemetry.classList.remove('d-none');
    
    try {
        const response = await fetch(`${TELEMETRY_API_BASE}/api/system/usage`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        
        hostTelemetry.innerHTML = `
            <div class="row g-3 font-monospace" style="color: #e2e8f0; font-size: 0.9rem;">
                <div class="col-md-6">
                    <div><span style="color: #38bdf8;"><i class="fab fa-windows me-2"></i>Host System:</span> ${data.os} (${data.architecture})</div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-microchip me-2"></i>CPU Load:</span> ${data.cpuUsage} <small class="text-muted">(${data.cpuCores} Cores)</small></div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-memory me-2"></i>System RAM:</span> ${data.ram}</div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-desktop me-2"></i>Graphics:</span> ${data.gpu}</div>
                </div>
                <div class="col-md-6">
                    <div><span style="color: #38bdf8;"><i class="fas fa-clock me-2"></i>Node Uptime:</span> ${data.uptime}</div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-database me-2"></i>Root Volume:</span> ${data.storage}</div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-tasks me-2"></i>Kernel Tasks:</span> ${data.processCount} running PIDs</div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-cloud-sun me-2"></i>Environment:</span> ${data.weather}</div>
                </div>
                <div class="col-12 mt-2 pt-2 border-top" style="border-color: #222226 !important; font-size: 0.8rem; color: #888892; display: flex; justify-content: space-between;">
                    <span>STARDATE: ${data.stardate}</span>
                    <span>RUNTIME: ${data.framework}</span>
                    <span>HITS: ${data.totalRequestsHandled}</span>
                </div>
            </div>`;
    } catch {
        hostTelemetry.innerHTML = `
            <div style="color: #f87171; font-size: 0.85rem;">
                <i class="fas fa-exclamation-triangle me-2"></i>[OFFLINE] Status module dropped connection. Workstation node may be processing kernel level updates or running detached.
            </div>`;
    }
}

async function fetchRandomGame(vanityUrl) {
    const input = vanityUrl || document.getElementById('demoSteamInput').value.trim();
    const activeOutput = vanityUrl ? terminalOutput : demoOutput;

    if (!input) {
        activeOutput.innerHTML = '<span class="text-danger">[ERROR] Please provide a VanityURL.</span>';
        return;
    }
    
    activeOutput.innerHTML = '<span class="text-warning">Connecting to Steam...</span>';
    try {
        const response = await fetch(`${STEAM_API_BASE}/api/Steam/RandomGameByVanityUrl/${encodeURIComponent(input)}`);
        
        if (!response.ok) {
            let errorDetail = 'Could not resolve account or fetch games.';
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
        const appId = target.steam_appid || target.steamAppId || target.appId || target.AppId;

        if (!gameName) {
            activeOutput.innerHTML = '<span class="text-danger">[ERROR] Account has no games or the profile/library is private.</span>';
            return;
        }

        activeOutput.innerHTML = `[SUCCESS] Game Selected: <strong>${gameName}</strong> <br /><small>AppID: ${appId}</small>`;
    } catch (err) {
        activeOutput.innerHTML = '<span class="text-danger">[ERROR] Network error: Could not reach the API server.</span>';
    }
}