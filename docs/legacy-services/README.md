# Previous Services implementation

The original `Source/Services/` catalog, styles, and JavaScript are preserved here unchanged while `/services/` serves the temporary Systems landing page. This directory is outside the published static root, so the old inventory is not presented as current public information.

The implementation includes searchable service entries, node selection, sanitized Agent snapshots, automatic/manual refresh, container/protocol tables, and unavailable-state handling. It also retains the original hosting/affiliate content and disclosure. Audit the inventory, host assignments, and copy before reusing it.

To restore or adapt it, copy `index.html`, `services.css`, and `services.js` together into `Source/services/`. The HTML's `../styles.css`, the JavaScript's `../js/config.js` import, and its existing asset paths are relative to that location. Serve `Source/` as the web root; do not serve this archive directly. The live controller uses the existing public `/api/services/hosts` endpoint and requires no backend changes.

Keep the lowercase public directory so `/services/` works on case-sensitive static hosts. Preserve affiliate links and commission disclosures when adapting the archived page.
