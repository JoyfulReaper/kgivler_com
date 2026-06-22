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

// Command Proccesor 
async function processCommand(input) {
    if (!input) return;

    // Parse command and arguments
    const parts = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cmd = parts[0].toLowerCase();
    // Strip quotes from arguments if they exist
    const args = parts.slice(1).map(arg => arg.replace(/^["'](.*)["']$/, '$1'));
    
    if (terminalInput) {
        terminalInput.value = '';
    }

    // TODO: Break into methods or w/e JavaScript call them
    switch (cmd) {
        case 'help': // Help command
            terminalOutput.innerHTML = `[INFO] Available commands: random [vanityUrl], clear, cowsay, stats, ls, pwd, echo, cat, play, neofetch, sudo, uname, top, whoami, date, history`;
            break;
        case 'clear': // Clear command
            terminalOutput.innerHTML = '';
            demoOutput.innerHTML = '';
            break;
        case 'random': // Random Steam Game
            fetchRandomGame(parts[1]);
            break;
        case 'pwd': // pwd command
            terminalOutput.innerHTML = '/home/kyle/workspace/kgivler.com';
            break;
        case 'echo': // Echo command
            // Basic XSS escape
            terminalOutput.innerHTML = args.join(' ').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            break;
        case 'ls': // ls command
            // Emulate a realistic directory listing with permissions
            terminalOutput.innerHTML = `
                <div style="color: #e2e8f0; line-height: 1.5;">
                    <span style="color: #38bdf8;">drwxr-xr-x</span> ./<br>
                    <span style="color: #38bdf8;">drwxr-xr-x</span> ../<br>
                    <span style="color: #e2e8f0;">-rw-r--r--</span> LICENSE.txt<br>
                    <span style="color: #e2e8f0;">-rw-r--r--</span> Far_Cry_Play_Order.md<br>
                    <span style="color: #39ff14;">-rwxr-xr-x</span> BetterTradeColors.dll<br>
                    <span style="color: #39ff14;">-rwxr-xr-x</span> RandomSteamGameBlazor.Server.dll
                </div>`;
            break;
        case 'cat': // cat command
            if (args.length === 0) {
                terminalOutput.innerHTML = `<span class="text-danger">cat: missing file operand</span>`;
            } else if (args[0] === 'LICENSE.txt') {
                terminalOutput.innerHTML = `<pre style="color: #888892; font-size: 0.8rem; white-space: pre-wrap; margin:0;">
BSD 2-Clause License

Copyright (c) 2026, Kyle Givler

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
</pre>`;
            } else if (args[0] === 'Far_Cry_Play_Order.md') {
                terminalOutput.innerHTML = `<span style="color: #e2e8f0;"># Playthrough List<br/>1. Far Cry 6<br/>2. Far Cry New Dawn<br/>3. Far Cry 5<br/>4. Far Cry Primal<br/>5. Far Cry 4<br/>6. Far Cry 3</span>`;
            } else {
                terminalOutput.innerHTML = `cat: ${args[0].replace(/</g, '&lt;')}: No such file or directory`;
            }
            break;
        case 'sudo': // sudo command
            terminalOutput.innerHTML = `<span class="text-danger">[SECURITY] User kyle is not in the sudoers file. This incident will be reported to Mr. God.</span>`;
            break;
        case 'play': // play command
        case 'music': // music command
            terminalOutput.innerHTML = `
                <div style="color: #38bdf8;">
                    <i class="fas fa-volume-up me-2 animate-pulse"></i>Now playing: <strong>Infant Annihilator / Rings of Saturn</strong> mix <br/>
                    <small class="text-muted">Genre: Technical Deathcore | Blast beats: Engaged</small>
                </div>`;
            break;
        case 'neofetch': // neofetch command
            terminalOutput.innerHTML = '<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i>Gathering system info...</span>';
            
            try {
                const res = await fetch(`${TELEMETRY_API_BASE}/api/system/usage`);
                if (!res.ok) throw new Error();
                
                const data = await res.json();
                const gpuName = data.gpu.name ? data.gpu.name : (data.gpu.error || "Unknown GPU");

                terminalOutput.innerHTML = `
<pre style="color: #39ff14; font-size: 0.8rem; line-height: 1.2; margin: 0;">
      /\\        <span style="color: #38bdf8; font-weight: bold;">kyle@kgivler</span>
     /  \\       ------------
    /____\\      <span style="color: #ffffff;">OS:</span>     ${data.os} (${data.architecture})
   /      \\     <span style="color: #ffffff;">Kernel:</span> ${data.framework}
  /________\\    <span style="color: #ffffff;">Uptime:</span> ${data.uptime}
 /          \\   <span style="color: #ffffff;">CPU:</span>    ${data.cpuUsage}
/____________\\  <span style="color: #ffffff;">RAM:</span>    ${data.ram}
                <span style="color: #ffffff;">GPU:</span>    ${gpuName}
</pre>`;
                
                // push fresh data to update the host telemetry box too
                await initHostTelemetry(data); 
            } catch {
                terminalOutput.innerHTML = '<span class="text-danger">[ERROR] Could not retrieve system data. Host offline.</span>';
            }
            break;
        case 'cowsay': // Cowsay command
            const msg = args.length > 0 ? args.join(' ').replace(/</g, '&lt;') : "Moo.";
            terminalOutput.innerHTML = `<pre style="color: #e2e8f0;">
 ${'_'.repeat(msg.length + 2)}
< ${msg} >
 ${'-'.repeat(msg.length + 2)}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||
            </pre>`;
            break;
        case 'status':
        case 'uptime':
        case 'stats': // stats command
            terminalOutput.innerHTML = '<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i>Polling host engine...</span>';
            try {
                const res = await fetch(`${TELEMETRY_API_BASE}/api/system/usage`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                
                const gpuText = data.gpu.name 
                    ? `${data.gpu.name} (Load: ${data.gpu.loadPercentage}%, VRAM: ${data.gpu.vramUsedMB}MB / ${data.gpu.vramTotalMB}MB)`
                    : (data.gpu.error || data.gpu);

                terminalOutput.innerHTML = `
    <pre style="color: #38bdf8; font-family: monospace; line-height: 1.4; margin: 0;">
    <span style="color: #39ff14; font-weight: bold;">kyle@kgivler</span>
    ------------
    <span style="color: #ffffff;">OS:</span>        ${data.os}
    <span style="color: #ffffff;">Arch:</span>      ${data.architecture}
    <span style="color: #ffffff;">Runtime:</span>   ${data.framework}
    <span style="color: #ffffff;">Uptime:</span>    ${data.uptime}
    <span style="color: #ffffff;">Host CPU:</span>  ${data.cpuUsage}
    <span style="color: #ffffff;">Tasks:</span>     ${data.processCount}
    <span style="color: #ffffff;">RAM:</span>       ${data.ram}
    <span style="color: #ffffff;">GPU:</span>       ${gpuText}
    <span style="color: #ffffff;">Storage:</span>   ${data.storage}
    <span style="color: #ffffff;">Stardate:</span>  ${data.stardate}
    <span style="color: #ffffff;">Weather:</span>   ${data.weather}
    <span style="color: #ffffff;">Traffic:</span>   ${data.totalRequestsHandled}
    </pre>`;
                await initHostTelemetry(data); 
            }
            catch {
                terminalOutput.innerHTML = '<span class="text-danger">[ERROR] Command execution faulted.</span>';
            }
            break;
        case 'uname': // uname command
            if (args.includes('-a')) {
                terminalOutput.innerHTML = '<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i></span>';
                try {
                    const res = await fetch(`${TELEMETRY_API_BASE}/api/system/usage`);
                    if (!res.ok) throw new Error();
                    const data = await res.json();
                    terminalOutput.innerHTML = `${data.os} kgivler-web ${data.framework} ${data.architecture} GNU/Linux`;
                } catch {
                    terminalOutput.innerHTML = `Linux kgivler-web x86_64 GNU/Linux`;
                }
            } else {
                terminalOutput.innerHTML = 'Linux';
            }
            break;
        case 'top': // top command
            terminalOutput.innerHTML = '<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i>Sampling kernel...</span>';
            try {
                const res = await fetch(`${TELEMETRY_API_BASE}/api/system/usage`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                
                // Strip the '%' if it exists so we can format it nicely
                const cpuNum = data.cpuUsage.replace('%', '').trim();
                
                terminalOutput.innerHTML = `
<pre style="color: #e2e8f0; font-size: 0.8rem; line-height: 1.2; margin: 0; overflow-x: hidden;">
top - ${new Date().toLocaleTimeString('en-US', {hour12: false})} up ${data.uptime},  1 user,  load average: ${cpuNum}, 0.04, 0.01
Tasks: <span style="color: #ffffff;">${data.processCount}</span> total,   <span style="color: #ffffff;">1</span> running, <span style="color: #ffffff;">${data.processCount - 1}</span> sleeping,   0 stopped,   0 zombie
%Cpu(s):  <span style="color: #39ff14;">${cpuNum}</span> us,  1.2 sy,  0.0 ni, 95.0 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st
MiB Mem : <span style="color: #ffffff;">${data.ram}</span>
MiB Swap:    0.0 total,      0.0 free,      0.0 used. 

  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
    1 root      20   0  168864  12484   8412 S   0.0   0.1   0:02.14 systemd
  804 kyle      20   0 1204856 112456  48124 S  ${cpuNum}   4.5  12:04.22 RandomSteamGame
  901 kyle      20   0  542452  84512  21452 S   0.5   2.1   1:05.11 sqlite3
 1042 kyle      20   0   14452   4512   2452 R   0.1   0.1   0:00.02 top
</pre>`;
                await initHostTelemetry(data);
            } catch {
                terminalOutput.innerHTML = '<span class="text-danger">[ERROR] Unable to read procfs.</span>';
            }
            break;
        case 'whoami': // whoami command
            terminalOutput.innerHTML = 'kyle';
            break;
        case 'date': // date command
            terminalOutput.innerHTML = '<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i></span>';
            try {
                const res = await fetch(`${TELEMETRY_API_BASE}/api/system/usage`);
                const data = await res.json();
                const localDate = new Date().toString();
                terminalOutput.innerHTML = `${localDate}<br/><span style="color: #888892;">Stardate: ${data.stardate}</span>`;
            } catch {
                terminalOutput.innerHTML = new Date().toString();
            }
            break;
        case 'history': // history commadn
            terminalOutput.innerHTML = `
                <div style="color: #e2e8f0; line-height: 1.5;">
                    1  sudo rm -rf /<br>
                    2  git push --force origin main<br>
                    3  neofetch<br>
                    4  history
                </div>`;
            break;
        default: // unknown command
            const safeCmd = cmd.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            terminalOutput.innerHTML = `[ERROR] Command not found: ${safeCmd}. Type 'help' for options.`;
            break;
    }
}

// Accept optional payload to re-use active data frames 
async function initHostTelemetry(existingData = null) {
    if (!hostTelemetry) return;
    hostTelemetry.classList.remove('d-none');
    
    try {
        let data = existingData;

        if (!data) {
            const response = await fetch(`${TELEMETRY_API_BASE}/api/system/usage`);
            if (!response.ok) throw new Error();
            data = await response.json();
        }
        
        const gpuText = data.gpu.name 
            ? `${data.gpu.name} | Load: ${data.gpu.loadPercentage}% | VRAM: ${data.gpu.vramUsedMB}/${data.gpu.vramTotalMB}MB`
            : (data.gpu.error || data.gpu);
        
        hostTelemetry.innerHTML = `
            <div class="row g-0 g-md-3 font-monospace" style="color: #e2e8f0; font-size: 0.9rem;">
                <div class="col-md-6">
                    <div><span style="color: #38bdf8;"><i class="fab fa-windows me-2"></i>Host System:</span> ${data.os} (${data.architecture})</div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-microchip me-2"></i>CPU Load:</span> ${data.cpuUsage} <small class="text-muted">(${data.cpuCores} Cores)</small></div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-memory me-2"></i>System RAM:</span> ${data.ram}</div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-desktop me-2"></i>Graphics:</span> ${gpuText}</div>
                </div>
                <div class="col-md-6">
                    <div><span style="color: #38bdf8;"><i class="fas fa-clock me-2"></i>Node Uptime:</span> ${data.uptime}</div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-database me-2"></i>Root Volume:</span> ${data.storage}</div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-tasks me-2"></i>Kernel Tasks:</span> ${data.processCount} running PIDs</div>
                    <div><span style="color: #38bdf8;"><i class="fas fa-cloud-sun me-2"></i>Environment:</span> ${data.weather}</div>
                </div>
                <div class="col-12 mt-2 pt-2 border-top d-flex flex-column flex-sm-row justify-content-between gap-2" style="border-color: #222226 !important; font-size: 0.8rem; color: #888892;">
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