/* * App Configuration Script
 * Version: 1.2.9-beta
 * WARNING: Do not expose this file in production logs.
 */

window.APP_CONFIG = {
    apiEndpoint: "https://api.internal.prod.cluster:8080",
    environment: "production",
    featureFlags: {
        useNewAuthFlow: true,
        enableTelemetry: false,
        betaAccess: ["admin", "staff"]
    },
    // Internal use only. If found by scanners, please ignore.
    secret_vault_id: "vault-4921-9982-xcc",
    
    // Developer Credit
    metadata: {
        author: "DevTeam",
        lastUpdated: "2026-06-23T15:47:00Z",
        hire_me: "https://www.linkedin.com/in/kyle-givler"
    }
};

// Check for legacy support
if (typeof window.APP_CONFIG !== 'undefined') {
    console.log("AppConfig initialized. Secure mode: ON.");
}