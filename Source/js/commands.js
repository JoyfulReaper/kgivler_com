// TODO: Create a virtual filesystem files.js

import { PLAYLIST } from "./config.js";
import { elements, render, showError, showLoading, initHostTelemetry } from "./ui.js";
import { getSystemData, fetchRandomGame } from "./api.js";
import { API_CONFIG } from "./config.js";

// Private helpers
function runPlay() {
  const track = PLAYLIST[Math.floor(Math.random() * PLAYLIST.length)];

  render(`
        <div style="color: #38bdf8;">
            <i class="fas fa-volume-up me-2 animate-pulse"></i>Now playing: <strong>${track.band}</strong> <br/>
            <small class="text-muted">Genre: ${track.genre} | ${track.meta}</small>
        </div>
    `);
}

async function runTop() {
  showLoading("Sampling kernel...");
  const data = await getSystemData();
  if (!data) return showError("[ERROR] Unable to read procfs.");

  const cpuNum = data.cpuUsage.replace("%", "").trim();
  render(`
<pre style="color: #e2e8f0; font-size: 0.8rem; line-height: 1.2; margin: 0; overflow-x: hidden;">
top - ${new Date().toLocaleTimeString("en-US", { hour12: false })} up ${data.uptime},  1 user,  load average: ${cpuNum}, 0.04, 0.01
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
  showLoading("Polling host engine...");
  const data = await getSystemData();
  if (!data) return showError("[ERROR] Command execution faulted.");

  const formattedStorage = data.storage.toString().replace(/[\d.]+/, (match) => parseFloat(match).toFixed(2));
  const gpuText = data.gpu.name ? `${data.gpu.name} (Load: ${data.gpu.loadPercentage}%, VRAM: ${data.gpu.vramUsedMB}MB / ${data.gpu.vramTotalMB}MB)` : data.gpu.error || data.gpu;

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
    <span style="color: #ffffff;">Total Hits:</span>   ${data.totalRequestsHandled}
    </pre>`);
  initHostTelemetry(data);
}

async function runNeofetch() {
  showLoading("Gathering system info...");
  const data = await getSystemData();
  if (!data) return showError("[ERROR] Could not retrieve system data. Host unreachable.");

  const gpuName = data.gpu.name ? data.gpu.name : data.gpu.error || "Unknown GPU";
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
  showLoading("Caluclating stardate...");
  const data = await getSystemData();
  // Fallback to local date if API is down
  const dateStr = data ? data.stardate : new Date().toString();
  render(`${new Date().toString()}<br/><span style="color: #888892;">Stardate: ${dateStr}</span>`);
}

async function runUname(args) {
  showLoading("Looking up name...");
  if (args.includes("-a")) {
    const data = await getSystemData();
    if (data) {
      render(`${data.os} kgivler-web ${data.framework} ${data.architecture} GNU/Linux`);
    } else {
      render(`Linux kgivler-web x86_64 GNU/Linux`);
    }
  } else {
    render("Linux");
  }
}

async function runUptime() {
  showLoading("Querying system timers...");
  const data = await getSystemData();
  if (!data) return showError("[ERROR] Unable to fetch system initialization timers.");

  // Format current local time as HH:MM:SS
  const currentTime = new Date().toLocaleTimeString("en-US", { hour12: false });

  // Extract the raw CPU percentage to simulate a load average
  const cpuNum = data.cpuUsage.replace("%", "").trim();
  const loadAvg = (parseFloat(cpuNum) / 100).toFixed(2);

  // Standard Linux uptime format:
  // 16:45:22 up 5 days, 22:34,  1 user,  load average: 0.08, 0.04, 0.01
  render(`${currentTime} up ${data.uptime},  1 user,  load average: ${loadAvg}, 0.05, 0.01`);
}

async function runBbs(args) {
  showLoading("Dialing KGIVLER BBS node...");
  await new Promise((r) => setTimeout(r, 800)); // Takes awhile to dail ya feel me?

  // --- Show Command ---
  if (args.length > 0 && args[0].toLowerCase() === "show") {
    try {
      const response = await fetch(`${API_CONFIG.TELEMETRY}/api/bbs`);

      if (!response.ok) throw new Error("Busy");

      const messages = await response.json();

      if (messages.length === 0) {
        return render(`<pre style="color: #888;">[BOARD EMPTY: No messages found]</pre>`);
      }

      let output = `<pre style="color: #38bdf8; font-family: monospace; line-height: 1.4; margin: 0;">
__________________________________________
|                                          |
|         --- KGIVLER BBS v1.0 ---         |
|__________________________________________|
`;
      messages.forEach((m) => {
        const date = new Date(m.timestamp).toLocaleDateString();
        output += `[${date}] <strong>${m.author}</strong>: ${m.content}\n`;
      });
      output += `</pre>`;

      render(output);
      return;
    } catch (err) {
      // THE "BUSY TONE" AESTHETIC
      render(`<pre style="color: #ff3131; font-family: monospace; margin: 0;">
[!] CONNECT 2400 / ARQ
[!] ERROR: NO CARRIER
[!] BUSY TONE... (BBS currently offline)</pre>`);
      return;
    }
  }

  // --- Post Command ---
  if (args.length > 0) {
    try {
      const content = args.join(" ");
      const response = await fetch(`${API_CONFIG.TELEMETRY}/api/bbs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: "Visitor", content: content }),
      });

      if (response.ok) {
        render('<pre style="color: #39ff14; font-family: monospace; margin: 0;">Message transmitted and acknowledged.</pre>');
      } else {
        throw new Error("Post Failed");
      }
    } catch (e) {
      render(`<pre style="color: #ff3131; font-family: monospace; margin: 0;">[!] CONNECTION LOST. Message failed to send.</pre>`);
    }
    return;
  }

  render('<pre style="color: #e2e8f0; font-family: monospace; margin: 0;">Usage: bbs show | bbs [message]</pre>');
}

// --- PUBLIC EXPORT ---
export const Commands = {
  help: () => render(`[INFO] Available commands: random [vanityUrl], clear, cowsay, stats, ls, pwd, echo, cat, bbs, music, neofetch, sudo, uname, top, whoami, date, history`),
  clear: () => {
    elements.output.innerHTML = "";
    elements.demo.innerHTML = "";
  },
  pwd: () => render("/home/kyle/workspace/kgivler.com"),
  whoami: () => render("kyle"),
  bbs: (args) => runBbs(args),
  echo: (args) => render(args.join(" ").replace(/</g, "&lt;").replace(/>/g, "&gt;")),

  ls: () =>
    render(`
        <div style="color: #e2e8f0; line-height: 1.5;">
            <span style="color: #38bdf8;">drwxr-xr-x</span> ./<br>
            <span style="color: #38bdf8;">drwxr-xr-x</span> ../<br>
            <span style="color: #e2e8f0;">-rw-r--r--</span> LICENSE.txt<br>
            <span style="color: #e2e8f0;">-rw-r--r--</span> Far_Cry_Play_Order.md<br>
            <span style="color: #39ff14;">-rwxr-xr-x</span> BetterTradeColors.dll<br>
            <span style="color: #39ff14;">-rwxr-xr-x</span> RandomSteamGame.dll
        </div>`),

  cat: (args) => {
    if (args.length === 0) return showError("cat: missing file operand");
    if (args[0] === "LICENSE.txt")
      return render(`<pre style="color: #888892; font-size: 0.8rem; white-space: pre-wrap; margin:0;">
The MIT License (MIT)

Copyright 2026 Kyle Givler

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.
</pre>`);
    if (args[0] === "Far_Cry_Play_Order.md")
      return render(
        `<span style="color: #e2e8f0;"># Playthrough List<br/>1. Far Cry 6<br/>2. Far Cry New Dawn<br/>3. Far Cry 5<br/>4. Far Cry Primal<br/>5. Far Cry 4<br/>6. Far Cry 3<br/>7. Far Cry 2 (in progress)<br />WHY CAN I NEVER BEAT Far Cry 1????!</span>`,
      );
    return showError(`cat: ${args[0].replace(/</g, "&lt;")}: No such file or directory`);
  },

  play: () => runPlay(),
  music: () => runPlay(),

  cowsay: (args) => {
    const msg = args.length > 0 ? args.join(" ").replace(/</g, "&lt;") : "Moo.";
    render(
      `<pre style="color: #e2e8f0;"> ${"_".repeat(msg.length + 2)}<br>< ${msg} ><br> ${"-".repeat(msg.length + 2)}<br>        \\   ^__^<br>         \\  (oo)\\_______<br>            (__)\\       )\\/\\<br>                ||----w |<br>                ||     ||</pre>`,
    );
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
  history: () => render(`<div style="color: #e2e8f0; line-height: 1.5;">1  sudo rm -rf /<br>2  git push --force origin main<br>3  neofetch<br>4  history</div>`),
};
