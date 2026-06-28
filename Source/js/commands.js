import { PLAYLIST, API_CONFIG } from "./config.js";
import { getSystemData, fetchRandomGame } from "./api.js";
import { FileSystem } from "./files.js";
import { initHostTelemetry } from "./ui.js";

// Private helpers
function runPlay(args, ctx) {
  const track = PLAYLIST[Math.floor(Math.random() * PLAYLIST.length)];

  ctx.print(`
        <div style="color: #38bdf8;">
            <i class="fas fa-volume-up me-2 animate-pulse"></i>Now playing: <strong>${track.band}</strong> <br/>
            <small class="text-muted">Genre: ${track.genre} | ${track.meta}</small>
        </div>
    `);
}

async function runTop(args, ctx) {
  ctx.loading("Sampling kernel...");
  const data = await getSystemData();
  if (!data) return ctx.error("[ERROR] Unable to read procfs.");

  const cpuNum = data.cpuUsage.replace("%", "").trim();
  ctx.print(`
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

async function runStatus(args, ctx) {
  ctx.loading("Polling host engine...");
  const data = await getSystemData();
  if (!data) return ctx.error("[ERROR] Command execution faulted.");

  const formattedStorage = data.storage.toString().replace(/[\d.]+/, (match) => parseFloat(match).toFixed(2));
  const gpuText = data.gpu.name ? `${data.gpu.name} (Load: ${data.gpu.loadPercentage}%, VRAM: ${data.gpu.vramUsedMB}MB / ${data.gpu.vramTotalMB}MB)` : data.gpu.error || data.gpu;

  ctx.print(`
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

async function runNeofetch(args, ctx) {
  ctx.loading("Gathering system info...");
  const data = await getSystemData();
  if (!data) return ctx.error("[ERROR] Could not retrieve system data. Host unreachable.");

  const gpuName = data.gpu.name ? data.gpu.name : data.gpu.error || "Unknown GPU";
  ctx.print(`<pre style="color: #39ff14; font-size: 0.8rem; line-height: 1.2; margin: 0;">
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

async function runDate(args, ctx) {
  ctx.loading("Caluclating stardate...");
  const data = await getSystemData();
  // Fallback to local date if API is down
  const dateStr = data ? data.stardate : new Date().toString();
  ctx.print(`${new Date().toString()}<br/><span style="color: #888892;">Stardate: ${dateStr}</span>`);
}

async function runUname(args, ctx) {
  ctx.loading("Looking up name...");
  if (args.includes("-a")) {
    const data = await getSystemData();
    if (data) {
      ctx.print(`${data.os} kgivler-web ${data.framework} ${data.architecture} GNU/Linux`);
    } else {
      ctx.print(`Linux kgivler-web x86_64 GNU/Linux`);
    }
  } else {
    ctx.print("Linux");
  }
}

async function runUptime(args, ctx) {
  ctx.loading("Querying system timers...");
  const data = await getSystemData();
  if (!data) return ctx.error("[ERROR] Unable to fetch system initialization timers.");

  // Format current local time as HH:MM:SS
  const currentTime = new Date().toLocaleTimeString("en-US", { hour12: false });

  // Extract the raw CPU percentage to simulate a load average
  const cpuNum = data.cpuUsage.replace("%", "").trim();
  const loadAvg = (parseFloat(cpuNum) / 100).toFixed(2);

  // Standard Linux uptime format:
  // 16:45:22 up 5 days, 22:34,  1 user,  load average: 0.08, 0.04, 0.01
  ctx.print(`${currentTime} up ${data.uptime},  1 user,  load average: ${loadAvg}, 0.05, 0.01`);
}

const escapeHtml = (str) => {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

async function runBbs(args, ctx) {
  ctx.print("Dialing KGIVLER BBS node...");
  await new Promise((r) => setTimeout(r, 800));

  // --- Show Command ---
  if (args.length > 0 && args[0].toLowerCase() === "show") {
    try {
      const response = await fetch(`${API_CONFIG.TELEMETRY}/api/bbs`);

      if (!response.ok) throw new Error("Busy");

      const messages = await response.json();

      if (messages.length === 0) {
        return ctx.print(`<pre style="color: #888;">[BOARD EMPTY: No messages found]</pre>`);
      }

      let output = `<pre style="color: #38bdf8; font-family: monospace; line-height: 1.4; margin: 0;">
__________________________________________
|                                          |
|         --- KGIVLER BBS v1.0 ---         |
|__________________________________________|
`;
      messages.forEach((m) => {
        const date = new Date(m.timestamp).toLocaleDateString();
        const safeAuthor = escapeHtml(m.author);
        const safeContent = escapeHtml(m.content);
        output += `[${date}] <strong>${safeAuthor}</strong>: ${safeContent}\n`;
      });
      output += `</pre>`;

      ctx.print(output);
      return;
    } catch (err) {
      ctx.error(`<pre style="color: #ff3131; font-family: monospace; margin: 0;">
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
        ctx.print('<pre style="color: #39ff14; font-family: monospace; margin: 0;">Message transmitted and acknowledged.</pre>');
      } else {
        throw new Error("Post Failed");
      }
    } catch (e) {
      ctx.error(`<pre style="color: #ff3131; font-family: monospace; margin: 0;">[!] CONNECTION LOST. Message failed to send.</pre>`);
    }
    return;
  }

  ctx.print('<pre style="color: #e2e8f0; font-family: monospace; margin: 0;">Usage: bbs show | bbs [message]</pre>');
}

// --- PUBLIC EXPORT ---
export const Commands = {
  help: (_, ctx) => ctx.print(`[INFO] Available commands: random [vanityUrl], clear, cowsay, stats, ls, pwd, echo, cat, bbs, music, neofetch, sudo, uname, top, whoami, date, history`),
  clear: (_, ctx) => {
    ctx.clear();
  },
  pwd: (_, ctx) => ctx.print("/home/kyle/workspace/kgivler.com"),
  whoami: (_, ctx) => ctx.print("kyle"),
  bbs: (args, ctx) => runBbs(args, ctx),
  echo: (args, ctx) => ctx.print(escapeHtml(args.join(" "))),

  ls: (_, ctx) => {
    const files = Object.keys(FileSystem)
      .map((f) => `-rw-r--r-- ${f}`)
      .join("<br>");
    ctx.print(`<div style="color: #e2e8f0;">drwxr-xr-x ./<br>drwxr-xr-x ../<br>${files}</div>`);
  },

  cat: (args, ctx) => {
    if (!args || args.length === 0) {
      return ctx.error("cat: missing file operand");
    }

    const file = FileSystem[args[0]];

    if (file) {
      ctx.print(file);
    } else {
      ctx.error(`cat: ${args[0]}: No such file or directory`);
    }
  },

  play: (_, ctx) => runPlay(_, ctx),
  music: (_, ctx) => runPlay(_, ctx),

  cowsay: (args, ctx) => {
    const msg = args.length > 0 ? args.join(" ").replace(/</g, "&lt;") : "Moo.";
    ctx.print(
      `<pre style="color: #e2e8f0;"> ${"_".repeat(msg.length + 2)}<br>< ${msg} ><br> ${"-".repeat(msg.length + 2)}<br>        \\   ^__^<br>         \\  (oo)\\_______<br>            (__)\\       )\\/\\<br>                ||----w |<br>                ||     ||</pre>`,
    );
  },

  sudo: (_, ctx) => ctx.print('<span class="text-danger">[SECURITY] User kyle is not in the sudoers file. Incident reported.</span>'),

  random: (args, ctx) => fetchRandomGame(args[0], ctx),
  neofetch: (args, ctx) => runNeofetch(args, ctx),
  top: (args, ctx) => runTop(args, ctx),
  status: (args, ctx) => runStatus(args, ctx),
  uptime: (args, ctx) => runUptime(args, ctx),
  stats: (args, ctx) => runStatus(args, ctx),
  date: (args, ctx) => runDate(args, ctx),
  uname: (args, ctx) => runUname(args, ctx),
  history: (_, ctx) => ctx.print(`<div style="color: #e2e8f0; line-height: 1.5;">1  sudo rm -rf /<br>2  git push --force origin main<br>3  neofetch<br>4  history</div>`),
};
