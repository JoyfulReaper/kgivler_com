// --- CONFIGURATION ---
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_CONFIG = {
    TELEMETRY: IS_LOCAL ? 'http://localhost:5081' : 'https://api.kgivler.com',
    STEAM: IS_LOCAL ? 'http://localhost:5281' : 'https://randomsteam.kgivler.com'
};

// --- STATE ---
let isFetching = false;

// --- DOM ELEMENTS ---
const elements = {
    input: document.getElementById('terminalCommandInput'),
    output: document.getElementById('terminal-output'),
    demo: document.getElementById('demo-output'),
    telemetry: document.getElementById('host-telemetry')
};

// --- RENDER HELPERS ---
const render = (html) => { elements.output.innerHTML = html; };
const showError = (msg) => { render(`<span class="text-danger">${msg}</span>`); };
const showLoading = () => { render('<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i>Processing...</span>'); };

// --- COMMAND REGISTRY ---
const Commands = {
    help: () => render(`[INFO] Available commands: random [vanityUrl], clear, cowsay, stats, ls, pwd, echo, cat, play, neofetch, sudo, uname, top, whoami, date, history`),
    clear: () => { elements.output.innerHTML = ''; elements.demo.innerHTML = ''; },
    pwd: () => render('/home/kyle/workspace/kgivler.com'),
    whoami: () => render('kyle'),
    echo: (args) => render(args.join(' ').replace(/</g, '&lt;').replace(/>/g, '&gt;')),
    
    ls: () => render(`
        <div style="color: #e2e8f0; line-height: 1.5;">
            <span style="color: #38bdf8;">drwxr-xr-x</span> ./<br>
            <span style="color: #38bdf8;">drwxr-xr-x</span> ../<br>
            <span style="color: #e2e8f0;">-rw-r--r--</span> LICENSE.txt<br>
            <span style="color: #e2e8f0;">-rw-r--r--</span> Far_Cry_Play_Order.md<br>
            <span style="color: #39ff14;">-rwxr-xr-x</span> BetterTradeColors.dll<br>
            <span style="color: #39ff14;">-rwxr-xr-x</span> RandomSteamGameBlazor.Server.dll
        </div>`),

    cat: (args) => {
        if (args.length === 0) return showError('cat: missing file operand');
        if (args[0] === 'LICENSE.txt') return render(`<pre style="color: #888892; font-size: 0.8rem; white-space: pre-wrap; margin:0;">
BSD 2-Clause License

Copyright (c) 2026, Kyle Givler

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
</pre>`);
        if (args[0] === 'Far_Cry_Play_Order.md') return render(`<span style="color: #e2e8f0;"># Playthrough List<br/>1. Far Cry 6<br/>2. Far Cry New Dawn<br/>3. Far Cry 5<br/>4. Far Cry Primal<br/>5. Far Cry 4<br/>6. Far Cry 3</span>`);
        return showError(`cat: ${args[0].replace(/</g, '&lt;')}: No such file or directory`);
    },

    play: () => render(`
                <div style="color: #38bdf8;">
                    <i class="fas fa-volume-up me-2 animate-pulse"></i>Now playing: <strong>Infant Annihilator / Rings of Saturn</strong> mix <br/>
                    <small class="text-muted">Genre: Technical Deathcore | Blast beats: Engaged</small>
                </div>`),
    music: () => Commands.play(), // Alias

    cowsay: (args) => {
        const msg = args.length > 0 ? args.join(' ').replace(/</g, '&lt;') : "Moo.";
        render(`<pre style="color: #e2e8f0;"> ${'_'.repeat(msg.length + 2)}<br>< ${msg} ><br> ${'-'.repeat(msg.length + 2)}<br>        \\   ^__^<br>         \\  (oo)\\_______<br>            (__)\\       )\\/\\<br>                ||----w |<br>                ||     ||</pre>`);
    },

    sudo: () => render('<span class="text-danger">[SECURITY] User kyle is not in the sudoers file. Incident reported.</span>'),
    
    random: (args) => fetchRandomGame(args[0]),
    neofetch: () => runNeofetch(),
    top: () => runTop(),
    status: () => runStatus(),
    uptime: () => runUptime(),
    stats: () => runStatus(),
    date: () => runDate(),
    uname: (args) => runUname(args),
    history: () => render(`<div style="color: #e2e8f0; line-height: 1.5;">1  sudo rm -rf /<br>2  git push --force origin main<br>3  neofetch<br>4  history</div>`)
};

// --- CORE LOGIC ---

async function processCommand(input) {
    if (!input)
         return;

    elements.input.value = '';

    const parts = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).map(arg => arg.replace(/^["'](.*)["']$/, '$1'));

    if (Commands[cmd]) {
        await Commands[cmd](args);
    } else {
        showError(`Command not found: ${cmd}. Type 'help' for options.`);
    }
}

async function getSystemData() {
    if (isFetching) return null; // Prevent overlapping requests
    isFetching = true;
    try {
        const res = await fetch(`${API_CONFIG.TELEMETRY}/api/system/usage`);
        if (!res.ok) throw new Error();
        return await res.json();
    } catch (e) {
        console.error("Fetch failed:", e);
        return null;
    } finally {
        isFetching = false;
    }
}

function initHostTelemetry(data) {
    if (!elements.telemetry) return;
    
    if (!data) {
        elements.telemetry.innerHTML = `<div class="text-danger">[OFFLINE]</div>`;
        return;
    }

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
                <div><span style="color: #38bdf8;"><i class="fas fa-database me-2"></i>Root Volume:</span> ${data.storage}</div>
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

// --- COMMAND HELPERS ---
async function fetchRandomGame(vanityUrl) {
    // If vanityUrl is passed, we are in the terminal. Otherwise, we are using the demo input.
    let input = vanityUrl || document.getElementById('demoSteamInput')?.value.trim();
    const activeOutput = vanityUrl ? elements.output : elements.demo;

    // Validate input
    if (!input) {
        input = "Mister_God"
        // activeOutput.innerHTML = '<span class="text-danger">[ERROR] Please provide a VanityURL.</span>';
        // return;
    }
    
    Commands.clear();

    activeOutput.innerHTML = '<span class="text-warning"><i class="fas fa-circle-notch fa-spin me-2"></i>Connecting to Steam...</span>';
    
    try {
        const response = await fetch(`${API_CONFIG.STEAM}/api/Steam/RandomGameByVanityUrl/${encodeURIComponent(input)}`);
        
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

async function runTop() {
    showLoading('Sampling kernel...');
    const data = await getSystemData();
    if (!data) return showError("[ERROR] Unable to read procfs.");

    const cpuNum = data.cpuUsage.replace('%', '').trim();
    render(`
<pre style="color: #e2e8f0; font-size: 0.8rem; line-height: 1.2; margin: 0; overflow-x: hidden;">
top - ${new Date().toLocaleTimeString('en-US', {hour12: false})} up ${data.uptime},  1 user,  load average: ${cpuNum}, 0.04, 0.01
Tasks: <span style="color: #ffffff;">${data.processCount}</span> total,   <span style="color: #ffffff;">1</span> running, <span style="color: #ffffff;">${data.processCount - 1}</span> sleeping,   0 stopped,   0 zombie
%Cpu(s):  <span style="color: #39ff14;">${cpuNum}</span> us,  1.2 sy,  0.0 ni, 95.0 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st
MiB Mem : <span style="color: #ffffff;">${data.ram}</span>
MiB Swap:    0.0 total,    0.0 free,    0.0 used. 

  PID USER       PR  NI    VIRT    RES    SHR S  %CPU  %MEM    TIME+ COMMAND
    1 root       20   0  168864  12484   8412 S  0.0   0.1   0:02.14 systemd
  804 kyle       20   0 1204856 112456  48124 S  ${cpuNum}   4.5  12:04.22 RandomSteamGame
  901 kyle       20   0  542452  84512  21452 S  0.5   2.1   1:05.11 sqlite3
 1042 kyle       20   0   14452   4512   2452 R  0.1   0.1   0:00.02 top
</pre>`);
    initHostTelemetry(data);
}

async function runStatus() {
    showLoading('Polling host engine...');
    const data = await getSystemData();
    if (!data) return showError("[ERROR] Command execution faulted.");

    const gpuText = data.gpu.name ? `${data.gpu.name} (Load: ${data.gpu.loadPercentage}%, VRAM: ${data.gpu.vramUsedMB}MB / ${data.gpu.vramTotalMB}MB)` : (data.gpu.error || data.gpu);
    render(`
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
    </pre>`);
    initHostTelemetry(data);
}

async function runNeofetch() {
    showLoading('Gathering system info...');
    const data = await getSystemData();
    if (!data) return showError("[ERROR] Could not retrieve system data. Host unreachable.");

    const gpuName = data.gpu.name ? data.gpu.name : (data.gpu.error || "Unknown GPU");
    render(`<pre style="color: #39ff14; font-size: 0.8rem; line-height: 1.2; margin: 0;">
      /\\        <span style="color: #38bdf8; font-weight: bold;">kyle@kgivler</span>
     /  \\       ------------
    /____\\      <span style="color: #ffffff;">OS:</span>     ${data.os} (${data.architecture})
   /      \\     <span style="color: #ffffff;">Kernel:</span> ${data.framework}
  /________\\    <span style="color: #ffffff;">Uptime:</span> ${data.uptime}
 /          \\   <span style="color: #ffffff;">CPU:</span>    ${data.cpuUsage}
/____________\\  <span style="color: #ffffff;">RAM:</span>    ${data.ram}
                <span style="color: #ffffff;">GPU:</span>    ${gpuName}
</pre>`);
    initHostTelemetry(data);
}

async function runDate() {
    const data = await getSystemData();
    // Fallback to local date if API is down
    const dateStr = data ? data.stardate : new Date().toString();
    render(`${new Date().toString()}<br/><span style="color: #888892;">Stardate: ${dateStr}</span>`);
}

async function runUname(args) {
    if (args.includes('-a')) {
        const data = await getSystemData();
        if (data) {
             render(`${data.os} kgivler-web ${data.framework} ${data.architecture} GNU/Linux`);
        } else {
             render(`Linux kgivler-web x86_64 GNU/Linux`);
        }
    } else {
        render('Linux');
    }
}

async function runUptime() {
    showLoading('Querying system timers...');
    const data = await getSystemData();
    if (!data) return showError("[ERROR] Unable to fetch system initialization timers.");

    // Format current local time as HH:MM:SS
    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    // Extract the raw CPU percentage to simulate a load average
    const cpuNum = data.cpuUsage.replace('%', '').trim();
    const loadAvg = (parseFloat(cpuNum) / 100).toFixed(2);

    // Standard Linux uptime format: 
    // 16:45:22 up 5 days, 22:34,  1 user,  load average: 0.08, 0.04, 0.01
    render(`${currentTime} up ${data.uptime},  1 user,  load average: ${loadAvg}, 0.05, 0.01`);
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const data = await getSystemData();
    initHostTelemetry(data);

    elements.input?.addEventListener('keypress', e => {
        if (e.key === 'Enter') processCommand(elements.input.value.trim());
    });
});