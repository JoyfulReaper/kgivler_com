import { IS_I2P } from "./config.js";

// Presentation only: optional API availability does not control promotions.
// Promotions start hidden in HTML so a failed script or no JS stays private.
for (const element of document.querySelectorAll('[data-hosting-promotion]')) {
    element.hidden = IS_I2P;
}

for (const element of document.querySelectorAll('[data-i2p-note]')) {
    element.hidden = !IS_I2P;
}
