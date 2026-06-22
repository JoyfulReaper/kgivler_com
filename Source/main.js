async function fetchRandomGame() {
    const input = document.getElementById('steamIdInput').value;
    const output = document.getElementById('demo-output');
    
    if (!input)
    { 
        output.innerHTML = '<span class="text-danger">[ERROR] Please enter your Steam VanityUrl.</span>';
        return;
    }

    output.innerHTML = '<span class="text-warning">Connecting to Steam...</span>';

    try {
        const response = await fetch(`https://randomsteam.kgivler.com/api/Steam/RandomGameByVanityUrl/${input}`);
        
        if (!response.ok) {
            console.error(`Fetch failed with status: ${response.status}`);
            throw new Error(`Server returned ${response.status}`);
        }
        
        const data = await response.json();
        console.log("API Response Data:", data);
        
        output.innerHTML = `
            <div class="output-line">
                [SUCCESS] Game Selected: <strong>${data.name}</strong><br/>
                <small>AppID: ${data.steam_appid}</small>
            </div>
        `;
    } catch (err) {
        console.error("Fetch error:", err);
        output.innerHTML = '<span class="text-danger">[ERROR] Could not resolve SteamID or service is down.</span>';
    }
}