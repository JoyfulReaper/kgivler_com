// Set an integration to null until it is available on I2P. No clearnet fallback.
export const I2P_SERVICES = Object.freeze({
    SITE_API: 'http://i3orcbjjienp2x53tplvjozico73xfhcelqr3lzav5yu5wghk4hq.b32.i2p',
    STEAM: 'http://randomsteam.i2p',
    QOTD: null
});

export function classifyNetwork(hostname) {
    const host = hostname.toLowerCase().replace(/\.$/, '');
    if (host === 'localhost' || host === '127.0.0.1') return 'local';
    if (host.endsWith('.i2p')) return 'i2p';
    if (host.endsWith('.ygg.kgivler.com') || host === '[301:762f:80bd:20e1::40]') return 'ygg';
    if (host.endsWith('.dn42')) return 'dn42';
    return 'clearnet';
}

export function getApiConfig(hostname, i2pServices = I2P_SERVICES) {
    const network = classifyNetwork(hostname);
    const [siteApi, steam, qotd] = network === 'i2p'
        ? [i2pServices.SITE_API ?? null, i2pServices.STEAM ?? null, i2pServices.QOTD ?? null]
        : network === 'local'
            ? ['http://localhost:5081', 'http://localhost:5182', 'http://localhost:5269']
            : network === 'ygg'
                ? ['http://api.ygg.kgivler.com', 'https://steam.ygg.kgivler.com', 'http://qotd.ygg.kgivler.com']
                : network === 'dn42'
                    ? ['https://api.kgivler.dn42', 'https://randomsteam.dn42', 'https://qotd.kgivler.dn42']
                    : ['https://api.kgivler.com', 'https://randomsteam.kgivler.com', 'https://qotd-api.kgivler.com'];

    return Object.freeze({
        SERVICES: siteApi,
        TELEMETRY: siteApi,
        GIT_ACTIVITY: siteApi,
        STEAM: steam,
        QOTD: qotd
    });
}

const NETWORK = classifyNetwork(window.location.hostname);
export const IS_LOCAL = NETWORK === 'local';
export const IS_YGG = NETWORK === 'ygg';
export const IS_DN42 = NETWORK === 'dn42';
export const IS_I2P = NETWORK === 'i2p';
export const API_CONFIG = getApiConfig(window.location.hostname);

export const PLAYLIST = Object.freeze([
    { band: "Infant Annihilator / Rings of Saturn mix", genre: "Technical Deathcore", meta: "Blast beats: Engaged" },
    { band: "Pat The Bunny", genre: "Folk Punk", meta: "Anarchy level: Maximum" },
    { band: "Johnny Hobo & The Freight Trains", genre: "Folk Punk", meta: "Existential crisis: Active" },
    { band: "Wingnut Dishwashers Union", genre: "Folk Punk", meta: "Capitalism: Questioned" },
    { band: "Ramshackle Glory", genre: "Folk Punk", meta: "Meaning of life: Not found" },
    { band: "Defiance, Ohio", genre: "Folk Punk", meta: "Violin violence: Enabled" },
    { band: "Days N Daze", genre: "Folk Punk", meta: "Acoustic damage: Maximum" },
    { band: "The Chariot", genre: "Chaotic Hardcore", meta: "Structural integrity: Compromised" },
    { band: "Terror", genre: "Hardcore Punk", meta: "Two-step protocol: Active" },
    { band: "Black Helicopters", genre: "Hardcore Punk", meta: "Volume knob: Insufficient" },
    { band: "Tech N9ne", genre: "Underground Hip-Hop", meta: "CPU usage: 100%" },
    { band: "Necro", genre: "Hardcore Hip-Hop", meta: "Subtlety: Disabled" },
    { band: "Ill Bill", genre: "Underground Hip-Hop", meta: "Conspiracy level: Moderate" },
    { band: "La Coka Nostra", genre: "Hardcore Hip-Hop", meta: "Threat assessment: Elevated" },
    { band: "Onyx", genre: "Hardcore Rap", meta: "Energy level: Breaking furniture" },
    { band: "M.O.P. / Ante Up", genre: "Aggressive Hip-Hop", meta: "Fight-or-flight: Fight" }
]);
