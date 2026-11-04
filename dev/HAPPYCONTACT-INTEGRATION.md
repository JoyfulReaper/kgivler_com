# dev.kgivler.com contact form integration with HappyContact

**Status: live on FrontDesk since November 4, 2026.** Go handles the public
form and forwards accepted submissions to the local HappyContact API. SQLite
remains the code default and the historical Go submission store is retained.

## Implemented switch

Set `DEV_CONTACT_BACKEND=happycontact`, `DEV_HAPPYCONTACT_BASE_URL` to the local
API origin (normally `http://127.0.0.1:5290`), and `DEV_HAPPYCONTACT_SITE_ID` to
the new site's GUID in protected server configuration. There is no default site
ID. Missing/invalid enabled configuration stops startup. Unset/empty backend or
`DEV_CONTACT_BACKEND=sqlite` keeps the original storage/notification path, even
if HappyContact settings are present.

The client posts validated JSON once, uses a three-second timeout within the
server's ten-second write timeout, follows no redirects, and bypasses environment
HTTP proxies. Only 202 triggers the existing 303 success redirect. It never
falls back, dual-writes, or calls the old ntfy notifier in HappyContact mode.
See [README.md](README.md#happycontact-backend-live-on-frontdesk) for response
mapping and all configuration names.

`DEV_CONTACT_TRUST_CLOUDFLARE_PROXY=false` is the default. Before setting it to
`true`, verify that the Go listener is accessible only through trusted local
ingress and cloudflared overwrites `CF-Connecting-IP`. In that mode, only one
valid IP in that header from a loopback peer is trusted. All other forwarded
headers are ignored; the canonical IP is used for both the contact limiter and
the newly constructed HappyContact request. Without trust enabled, use the
socket peer IP; tunneled visitors share the proxy's rate-limit budget. This
flag does not change the existing SQLite-mode, logging, or telemetry helpers.

Automated tests exercise synthetic site GUIDs and local HTTP servers. A
separate real production submission through the public Go endpoint and
HappyContact delivery workers was also verified on November 4, 2026; see
[Production cutover](#production-cutover-verified-november-4-2026).

## Input compatibility

The shared Go validator and HTML phone limit now enforce HappyContact's
40-character phone maximum before either backend is called. Phone format rules
were inspected in HappyContact's `dev` contract and .NET's `PhoneAttribute`, then
checked with .NET 10.0.14. Spaces, common punctuation, BMP decimal digits, plus
signs, and supported `x`/`ext`/`ext.` extensions are accepted; malformed values
receive a local HTTP 400 with guidance, without consuming rate-limit state.
Omitted/blank phone is still optional, and existing outer-whitespace trimming
is the only change to a submitted number's representation.

Subject now uses the upstream 200-UTF-16-unit limit, and email keeps its existing
254-character limit plus the upstream 320-unit cap. Name/message limits already
fit upstream's UTF-16 caps. These intentional input restrictions apply to SQLite
mode too, so switching backends does not change accepted formats. Existing stored
records are unaffected. See [the README input rules](README.md#contact-storage)
for the exact phone behavior and source references. No HappyContact code or
production configuration was changed by the validation-only code update.

## Current flow

`POST /contact` is a same-origin, `application/x-www-form-urlencoded` form handled by the Go service in `src/contact.go`. It enforces input limits/validation, rejects the `contact_guard` honeypot with HTTP 400, rate-limits valid attempts, forwards accepted production submissions to HappyContact, then issues HTTP 303 to `/contact-sent.html` only after HTTP 202. SQLite and its optional legacy ntfy notifier remain available when the backend is explicitly reverted. The form works without JavaScript; the optional frontend script only improves submit-state UX. A separate private WireGuard admin listener lists and manages historical Go contact submissions.

Do not remove or bypass these behaviors merely to use HappyContact. The existing Go SQLite database contains historical inquiries; keep it recoverable until any migration/retention decision is made.

## Production flow

```text
Browser --same-origin HTML form--> Go POST /contact
  -> existing body limits, validation, honeypot, rate limiting
  -> Go service POSTs JSON to local HappyContact API (127.0.0.1:5290)
  -> HappyContact transactionally stores submission + per-destination jobs
  -> Go returns existing 303 success redirect **only after HappyContact returns 202**
  -> HappyContact worker sends full message by SMTP, optionally minimal ntfy
  -> operator alert worker reports permanent delivery failures
```

Prefer the loopback connection because both applications run on FrontDesk. Do **not** make the browser submit directly to `contact.kgivler.com`: that needlessly adds cross-origin requests/CORS work and changes the no-JavaScript form. Keep the public `/contact` route and the existing success/error pages.

## Remaining verification considerations

The site-specific SMTP/ntfy, trusted-tunnel forwarding, successful submission,
no-dual-write, input validation, honeypot, privacy notice, and rollback
artifacts were verified during cutover. Additional browser-level testing for
duplicate clicks, timeout/failure response UX, and rate-limit edge cases is
still worthwhile; do not claim these were comprehensively exercised live.

## Production cutover (verified November 4, 2026)

- FrontDesk service: `devsite.service`, binary `/usr/local/bin/devsite`,
  config `/etc/devsite.env`. HappyContact is `happycontact.service`.
- Public ingress: Cloudflare-managed Tunnel `dev.kgivler.com` ->
  `http://127.0.0.1:5196`. The Go private admin binds to
  `10.99.0.14:5197` over WireGuard. Nginx is not part of this public route.
- Production settings (no credentials shown):

  ```ini
  DEV_CONTACT_BACKEND=happycontact
  DEV_HAPPYCONTACT_BASE_URL=http://127.0.0.1:5290
  DEV_HAPPYCONTACT_SITE_ID=38f0f400-8e96-4727-a7b2-89bd1aadcc8e
  DEV_CONTACT_TRUST_CLOUDFLARE_PROXY=true
  ```

- Dedicated HappyContact site has `DevSite Email` (Mailjet SMTP) and
  `DevSite ntfy` (topic `happycontact-devsite`, credential reference
  `DevSite`). Both destinations succeeded in one attempt during initial
  direct-site tests and in the live Go-to-HappyContact test.
- Public `POST /contact` returned HTTP 303; submission
  `B24DA123-8183-4E13-A8E5-385B40B2C123` produced two `Succeeded`
  delivery jobs, both in one attempt. Operator confirmed receiving both the
  email and ntfy notification.
- The same test name produced zero rows in the old Go SQLite database.
  A pre-cutover submission succeeded in Go SQLite (record 11). Two negative
  tests (invalid phone, populated `contact_guard`) returned HTTP 400 and
  produced zero HappyContact rows.
- Public health, systemd listeners, and the November 4 privacy-policy
  deployment were checked. A normal tunnel request logged the actual IPv6
  visitor address, not localhost. A deliberately spoofed `CF-Connecting-IP`
  request was rejected HTTP 403 before reaching Go; this supports but does
  not constitute a comprehensive header-spoofing audit.
- Historical Go SQLite: `/var/lib/devsite/contact.db`.
  Original binary preserved as
  `/usr/local/bin/devsite.pre-happycontact-20261104T213248Z`.
  Original configuration backed up at `/etc/devsite.env.pre-happycontact`,
  with `DEV_CONTACT_BACKEND` unset. Keep these private; the environment
  file contains operational configuration and may contain credentials.

### Operational rollback

For a backend-only rollback, set `DEV_CONTACT_BACKEND=sqlite` in
`/etc/devsite.env`, leaving the original `DEV_CONTACT_DB_PATH` and legacy
ntfy variables intact, then `sudo systemctl restart devsite.service`. This
changes **new** intake only. Confirm `/health/live`, send a controlled
submission, and check the Go SQLite admin/storage. Keep HappyContact's database
and pending jobs; do not assume uncertain/timed-out submissions are absent.
Reverting the backend does not require replacing the Go binary.

Only if the application binary itself needs rollback, use the preserved
timestamped executable after deliberately stopping/replacing the service
binary. Replacing a live executable or editing `/etc/devsite.env` is a
production change and should be performed during a controlled maintenance
step. The standard deployment script also writes
`/usr/local/bin/devsite.backup`, which can be overwritten by later deploys.

## Current HappyContact facts (verified November 4, 2026)

HappyContact is running on FrontDesk with public smoke endpoint `https://contact.kgivler.com` and a loopback API listener. Its separate WireGuard-only operator admin returned HTTP 404 through the public endpoint. The test site delivered ntfy and full Mailjet SMTP messages (with correct visitor `Reply-To`), and its independently configured operator ntfy worker alerted on a deliberately failed destination. FrontDesk's existing encrypted Restic job backs up the HappyContact database consistently and sends to three VPS destinations; a DeepDish restore of the database passed `PRAGMA integrity_check`.

The production `dev.kgivler.com` site has since been independently tested end
to end. Its dedicated permanent ntfy credential and the operator alert token
were installed and verified; the old temporary operator token was revoked.
The separate smoke-test destination may still rely on a temporary token.
