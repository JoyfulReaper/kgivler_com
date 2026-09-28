export const IS_LOCAL =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

export const IS_YGG =
    window.location.hostname.endsWith('.ygg.kgivler.com') ||
    window.location.hostname.endsWith('[301:762f:80bd:20e1::40]');

export const IS_DN42 =
    window.location.hostname.endsWith('.dn42');

const SITE_API_BASE = IS_LOCAL
    ? 'http://localhost:5081'
    : IS_YGG
        ? 'http://api.ygg.kgivler.com'
        : IS_DN42
            ? 'https://api.kgivler.dn42'
            : 'https://api.kgivler.com';

const STEAM_BASE = IS_LOCAL
    ? 'http://localhost:5182'
    : IS_YGG
        ? 'https://steam.ygg.kgivler.com'
        : IS_DN42
            ? 'https://randomsteam.dn42'
            : 'https://randomsteam.kgivler.com';

const QOTD_BASE = IS_LOCAL
    ? 'http://localhost:5269'
    : IS_DN42
        ? 'https://qotd.kgivler.dn42'
        : 'https://qotd-api.kgivler.com';

export const API_CONFIG = Object.freeze({
    SERVICES: SITE_API_BASE,
    TELEMETRY: SITE_API_BASE,
    GIT_ACTIVITY: SITE_API_BASE,
    STEAM: STEAM_BASE,
    QWENCODER: SITE_API_BASE,
    QOTD: QOTD_BASE
});

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
