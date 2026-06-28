export const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_CONFIG = Object.freeze({
    TELEMETRY: IS_LOCAL ? 'http://localhost:5081' : 'https://api.kgivler.com',
    STEAM: IS_LOCAL ? 'http://localhost:5182' : 'https://randomsteam.kgivler.com'
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