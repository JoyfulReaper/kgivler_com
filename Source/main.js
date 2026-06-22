const terminalInput = document.getElementById('terminalCommandInput');
const terminalOutput = document.getElementById('terminal-output');
const demoOutput = document.getElementById('demo-output');

terminalInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        processCommand(terminalInput.value.trim());
    }
});

function processCommand(input) {
    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    
    terminalInput.value = '';
    switch (cmd) {
        case 'help':
            terminalOutput.innerHTML = `[INFO] Available commands: random [vanity], clear, cowsay, stats`;
            break;
        case 'clear':
            terminalOutput.innerHTML = '';
            demoOutput.innerHTML = '';
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
        case 'random':
            fetchRandomGame(parts[1]);
            break;
        case 'stats':
            terminalOutput.innerHTML = `[SYSTEM] Backlog: 42 games | Last update: 2026-06-21`;
            break;
        default:
            terminalOutput.innerHTML = `[ERROR] Command not found: ${cmd}. Type 'help' for options.`;
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
        const response = await fetch(`https://randomsteam.kgivler.com/api/Steam/RandomGameByVanityUrl/${encodeURIComponent(input)}`);
        
        if (!response.ok) {
            let errorDetail = 'Could not resolve account or fetch games.';
            try {
                const problemJson = await response.json();
                errorDetail = problemJson.title || problemJson.detail || errorDetail;
            } catch (_) {
                // Fail silently if the payload isn't JSON
            }
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

        activeOutput.innerHTML = `[SUCCESS] Game Selected: <strong>${gameName}</strong> 
        <br />
        <small>AppID: ${appId}</small>`;
    } catch (err) {
        activeOutput.innerHTML = '<span class="text-danger">[ERROR] Network error: Could not reach the API server.</span>';
    }
}