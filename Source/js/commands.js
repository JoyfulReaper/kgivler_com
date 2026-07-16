import { PLAYLIST } from "./config.js";
import { getSystemData, fetchRandomGame, getBbsMessages, postBbsMessage } from "./api.js";
import { FileSystem } from "./files.js";
import { initHostTelemetry } from "./ui.js";
import { escapeHtml } from "./markdown.js";

const asText = (value, fallback = "Unknown") =>
  value === null || value === undefined
    ? fallback
    : String(value);

const safe = (value, fallback = "Unknown") =>
  escapeHtml(asText(value, fallback));

const getCpuNumber = (data) => {
  const raw = asText(data?.cpuUsage, "0");
  const parsed = parseFloat(raw.replace("%", "").trim());
  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

function formatBbsTimestamp(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString();
}

// Private helpers
function runPlay(args, ctx) {
  const track = PLAYLIST[Math.floor(Math.random() * PLAYLIST.length)];

  ctx.printTrustedHtml(`
        <div style="color: #38bdf8;">
            <i class="fas fa-volume-up me-2 animate-pulse"></i>Now playing: <strong>${safe(track.band)}</strong> <br/>
            <small class="text-muted">Genre: ${safe(track.genre)} | ${safe(track.meta)}</small>
        </div>
    `);
}

async function runTop(args, ctx) {
  ctx.loadingText("Sampling kernel...");
  const data = await getSystemData();
  if (!data) return ctx.errorText("Unable to read procfs.");

  const cpuNum = getCpuNumber(data).toFixed(1);
  const processCount = Math.max(Number(data.processCount) || 1, 1);
  ctx.printTrustedHtml(`
<pre style="color: #e2e8f0; font-size: 0.8rem; line-height: 1.2; margin: 0; overflow-x: hidden;">
top - ${new Date().toLocaleTimeString("en-US", { hour12: false })} up ${safe(data.uptime)},  1 user,  load average: ${safe(cpuNum)}, 0.04, 0.01
Tasks: <span style="color: #ffffff;">${safe(processCount)}</span> total,   <span style="color: #ffffff;">1</span> running, <span style="color: #ffffff;">${safe(processCount - 1)}</span> sleeping,   0 stopped,   0 zombie
%Cpu(s):  <span style="color: #39ff14;">${cpuNum}</span> us,  1.2 sy,  0.0 ni, 95.0 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st
MiB Mem : <span style="color: #ffffff;">${safe(data.ram)}</span>
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
  ctx.loadingText("Polling host engine...");
  const data = await getSystemData();
  if (!data) return ctx.errorText("Command execution faulted.");

  const formattedStorage = asText(data.storage).replace(/[\d.]+/, (match) => {
    const parsed = parseFloat(match);
    return Number.isFinite(parsed)
      ? parsed.toFixed(2)
      : match;
  });
  const gpuText =
    data.gpu && typeof data.gpu === "object" && data.gpu.name
      ? `${data.gpu.name} (Load: ${data.gpu.loadPercentage ?? "?"}%, VRAM: ${data.gpu.vramUsedMB ?? "?"}MB / ${data.gpu.vramTotalMB ?? "?"}MB)`
      : data.gpu?.error || data.gpu || "Unknown";

  ctx.printTrustedHtml(`
    <pre style="color: #38bdf8; font-family: monospace; line-height: 1.4; margin: 0;">
    <span style="color: #39ff14; font-weight: bold;">kyle@kgivler</span>
    ------------
    <span style="color: #ffffff;">OS:</span>        ${safe(data.os)}
    <span style="color: #ffffff;">Arch:</span>      ${safe(data.architecture)}
    <span style="color: #ffffff;">Runtime:</span>   ${safe(data.framework)}
    <span style="color: #ffffff;">Uptime:</span>    ${safe(data.uptime)}
    <span style="color: #ffffff;">Host CPU:</span>  ${safe(data.cpuUsage)}
    <span style="color: #ffffff;">Tasks:</span>     ${safe(data.processCount)}
    <span style="color: #ffffff;">RAM:</span>       ${safe(data.ram)}
    <span style="color: #ffffff;">GPU:</span>       ${safe(gpuText)}
    <span style="color: #ffffff;">Storage:</span>   ${safe(formattedStorage)}
    <span style="color: #ffffff;">Stardate:</span>  ${safe(data.stardate)}
    <span style="color: #ffffff;">Weather:</span>   ${safe(data.weather)}
    <span style="color: #ffffff;">Total Hits:</span>   ${safe(data.totalRequestsHandled)}
    </pre>`);
  initHostTelemetry(data);
}

async function runNeofetch(args, ctx) {
  ctx.loadingText("Gathering system info...");
  const data = await getSystemData();
  if (!data) return ctx.errorText("Could not retrieve system data. Host unreachable.");

  const gpuName =
    data.gpu && typeof data.gpu === "object" && data.gpu.name
      ? data.gpu.name
      : data.gpu?.error || "Unknown GPU";
  ctx.printTrustedHtml(`<pre style="color: #39ff14; font-size: 0.8rem; line-height: 1.2; margin: 0;">
      /\\        <span style="color: #38bdf8; font-weight: bold;">kyle@kgivler</span>
     /  \\       ------------
    /____\\      <span style="color: #ffffff;">OS:</span>     ${safe(data.os)} (${safe(data.architecture)})
   /      \\     <span style="color: #ffffff;">Kernel:</span> ${safe(data.framework)}
  /________\\    <span style="color: #ffffff;">Uptime:</span> ${safe(data.uptime)}
 /          \\   <span style="color: #ffffff;">CPU:</span>    ${safe(data.cpuUsage)}
/____________\\  <span style="color: #ffffff;">RAM:</span>    ${safe(data.ram)}
                <span style="color: #ffffff;">GPU:</span>    ${safe(gpuName)}
</pre>`);
  initHostTelemetry(data);
}

async function runDate(args, ctx) {
  ctx.loadingText("Caluclating stardate...");
  const data = await getSystemData();
  // Fallback to local date if API is down
  const dateStr = data ? data.stardate : new Date().toString();
  ctx.printTrustedHtml(`${escapeHtml(new Date().toString())}<br/><span style="color: #888892;">Stardate: ${safe(dateStr)}</span>`);
}

async function runUname(args, ctx) {
  ctx.loadingText("Looking up name...");
  if (args.includes("-a")) {
    const data = await getSystemData();
    if (data) {
      ctx.printText(`${asText(data.os)} kgivler-web ${asText(data.framework)} ${asText(data.architecture)} GNU/Linux`);
    } else {
      ctx.printText("Linux kgivler-web x86_64 GNU/Linux");
    }
  } else {
    ctx.printText("Linux");
  }
}

async function runUptime(args, ctx) {
  ctx.loadingText("Querying system timers...");
  const data = await getSystemData();
  if (!data) return ctx.errorText("Unable to fetch system initialization timers.");

  // Format current local time as HH:MM:SS
  const currentTime = new Date().toLocaleTimeString("en-US", { hour12: false });

  // Extract the raw CPU percentage to simulate a load average
  const cpuNum = String(getCpuNumber(data));
  const loadAvg = (parseFloat(cpuNum) / 100).toFixed(2);

  // Standard Linux uptime format:
  // 16:45:22 up 5 days, 22:34,  1 user,  load average: 0.08, 0.04, 0.01
  ctx.printText(`${currentTime} up ${asText(data.uptime)},  1 user,  load average: ${loadAvg}, 0.05, 0.01`);
}

async function runBbs(args, ctx) {
  ctx.printText("Dialing KGIVLER BBS node...");
  await new Promise((r) => setTimeout(r, 800));

  const subcommand = args[0]?.toLowerCase();

  // --- Show Command ---
  if (subcommand === "show") {
    const result = await getBbsMessages();

    if (!result.ok) {
      ctx.printTrustedHtml(`<pre style="color: #ff3131; font-family: monospace; margin: 0;">
[!] CONNECT 2400 / ARQ
[!] ERROR: NO CARRIER
[!] BUSY TONE... (${escapeHtml(result.error || "BBS currently offline")})</pre>`);
      return;
    }

    const messages = result.value;

    if (messages.length === 0) {
      return ctx.printTrustedHtml(`<pre style="color: #888;">[BOARD EMPTY: No messages found]</pre>`);
    }

    let output = `<pre style="color: #38bdf8; font-family: monospace; line-height: 1.4; margin: 0;">
__________________________________________
|                                          |
|         --- KGIVLER BBS v1.0 ---         |
|__________________________________________|
`;
    messages.forEach((m) => {
      const date = formatBbsTimestamp(m?.timestamp);
      const safeAuthor = escapeHtml(m?.author || "Visitor");
      const safeContent = escapeHtml(m?.content || "");
      output += `[${escapeHtml(date)}] <strong>${safeAuthor}</strong>: ${safeContent}\n`;
    });
    output += `</pre>`;

    ctx.printTrustedHtml(output);
    return;
  }

  // --- Post Command ---
  if (subcommand === "message") {
    if (args.length < 2) {
      ctx.printTrustedHtml('<pre style="color: #e2e8f0; font-family: monospace; margin: 0;">Usage: bbs message [message]</pre>');
      return;
    }

    const content = args.slice(1).join(" ");
    const result = await postBbsMessage(content);

    if (result.ok) {
      ctx.printTrustedHtml('<pre style="color: #39ff14; font-family: monospace; margin: 0;">Message transmitted and acknowledged.</pre>');
    } else {
      ctx.printTrustedHtml(`<pre style="color: #ff3131; font-family: monospace; margin: 0;">[!] CONNECTION LOST. ${escapeHtml(result.error || "Message failed to send.")}</pre>`);
    }
    return;
  }

  ctx.printTrustedHtml('<pre style="color: #e2e8f0; font-family: monospace; margin: 0;">Usage: bbs show | bbs message [message]</pre>');
}

// --- PUBLIC EXPORT ---
export const Commands = {
  help: (_, ctx) => ctx.printText(`[INFO] Available commands: random [steamId|vanityUrl|profileUrl], get-random-game [steamId|vanityUrl|profileUrl], clear, cowsay, stats, ls, pwd, echo, cat, bbs, music, neofetch, sudo, uname, top, whoami, date, history`),
  clear: (_, ctx) => {
    ctx.clear();
  },
  pwd: (_, ctx) => ctx.printText("/home/kyle/workspace/kgivler.com"),
  whoami: (_, ctx) => ctx.printText("kyle"),
  bbs: (args, ctx) => runBbs(args, ctx),
  echo: (args, ctx) => ctx.printText(args.join(" ")),

  ls: (_, ctx) => {
    const files = Object.keys(FileSystem)
      .map((f) => `-rw-r--r-- ${f}`)
      .join("<br>");
    ctx.printTrustedHtml(`<div style="color: #e2e8f0;">drwxr-xr-x ./<br>drwxr-xr-x ../<br>${files}</div>`);
  },

  cat: (args, ctx) => {
    if (!args || args.length === 0) {
      return ctx.errorText("cat: missing file operand");
    }

    const filename = args[0];
    const file =
      Object.hasOwn(FileSystem, filename)
        ? FileSystem[filename]
        : null;

    if (file) {
      ctx.printTrustedHtml(file);
    } else {
      ctx.errorText(`cat: ${filename}: No such file or directory`);
    }
  },

  play: (_, ctx) => runPlay(_, ctx),
  music: (_, ctx) => runPlay(_, ctx),

  cowsay: (args, ctx) => {
    const rawMessage = args.length > 0 ? args.join(" ") : "Moo.";
    const msg = escapeHtml(rawMessage);
    ctx.printTrustedHtml(
      `<pre style="color: #e2e8f0;"> ${"_".repeat(rawMessage.length + 2)}<br>< ${msg} ><br> ${"-".repeat(rawMessage.length + 2)}<br>        \\   ^__^<br>         \\  (oo)\\_______<br>            (__)\\       )\\/\\<br>                ||----w |<br>                ||     ||</pre>`,
    );
  },

  sudo: (_, ctx) => ctx.printTrustedHtml('<span class="text-danger">[SECURITY] User kyle is not in the sudoers file. Incident reported.</span>'),

  random: (args, ctx) => fetchRandomGame(args[0], ctx),
  "get-random-game": (args, ctx) => fetchRandomGame(args[0], ctx),
  "./get-random-game": (args, ctx) => fetchRandomGame(args[0], ctx),
  neofetch: (args, ctx) => runNeofetch(args, ctx),
  top: (args, ctx) => runTop(args, ctx),
  status: (args, ctx) => runStatus(args, ctx),
  uptime: (args, ctx) => runUptime(args, ctx),
  stats: (args, ctx) => runStatus(args, ctx),
  date: (args, ctx) => runDate(args, ctx),
  uname: (args, ctx) => runUname(args, ctx),
  history: (_, ctx) => ctx.printTrustedHtml(`<div style="color: #e2e8f0; line-height: 1.5;">1  sudo rm -rf /<br>2  git push --force origin main<br>3  neofetch<br>4  history</div>`),
};
