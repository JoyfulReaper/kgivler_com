# dev.kgivler.com contact form integration with HappyContact

**Status: opt-in Go client implemented; no live cutover performed.** SQLite and
the optional Go ntfy notification remain the default. The live deployment,
Cloudflare tunnel, and HappyContact service are unchanged by this work.

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
See [README.md](README.md#opt-in-happycontact-backend-not-deployed) for response
mapping and all configuration names.

`DEV_CONTACT_TRUST_CLOUDFLARE_PROXY=false` is the default. Before setting it to
`true`, verify that the Go listener is accessible only through trusted local
ingress and cloudflared overwrites `CF-Connecting-IP`. In that mode, only one
valid IP in that header from a loopback peer is trusted. All other forwarded
headers are ignored; the canonical IP is used for both the contact limiter and
the newly constructed HappyContact request. Without trust enabled, use the
socket peer IP; tunneled visitors share the proxy's rate-limit budget. This
flag does not change the existing SQLite-mode, logging, or telemetry helpers.

Tests use a synthetic site GUID and local HTTP servers, not the deployed
HappyContact service. No real submission, SMTP delivery, or production proxy
configuration has been tested by this change.

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
production configuration was changed.

## Current flow (preserve until validated)

`POST /contact` is a same-origin, `application/x-www-form-urlencoded` form handled by the Go service in `src/contact.go`. It enforces input limits/validation, rejects the `contact_guard` honeypot with HTTP 400, rate-limits valid attempts, stores data in the Go service's SQLite database by default, optionally sends a minimal ntfy notification, then issues HTTP 303 to `/contact-sent.html`. The form works without JavaScript; the optional frontend script only improves submit-state UX. A separate private WireGuard admin listener lists and manages historical Go contact submissions.

Do not remove or bypass these behaviors merely to use HappyContact. The existing Go SQLite database contains historical inquiries; keep it recoverable until any migration/retention decision is made.

## Target flow

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

## Before any switch

1. In HappyContact's private admin UI, create a **new site specifically for `dev.kgivler.com`** (do not reuse the `HappyContact Smoke Test` site). Configure and verify at least one SMTP destination that sends the complete message to the intended mailbox. An optional ntfy destination is secondary.
2. Configure and test the implemented client using the settings above. Keep the base URL and site ID server-side. Do not log submissions or provider credentials.
3. Verify the field mapping and failure pages with the provisioned site. Local validation now matches the inspected phone and string-length rules; test omitted optional fields, supported phone formats, and Unicode subject/email boundaries. Values are never silently rewritten or discarded. Site enablement, queue capacity, rate limits, and future upstream contract changes can still reject a locally valid submission.
4. **Do not silently dual-write** to Go SQLite and HappyContact or automatically fall back to the old store after an uncertain upstream timeout; either can cause duplicate/misleading messages. Plan an explicit, reversible cutover and preserve the old database for rollback/historical access.
5. Verify the trusted ingress before enabling `DEV_CONTACT_TRUST_CLOUDFLARE_PROXY`. Confirm distinct visitors reach both limiters under distinct canonical IPs, and direct/non-loopback spoofed headers cannot override the socket peer. HappyContact trusts the Go-generated `CF-Connecting-IP` only from loopback. Browser CORS is not needed for this same-origin form.
6. Test a real submission end-to-end: browser submit/redirect, HappyContact receipt and SQLite jobs, full SMTP email with correct visitor `Reply-To`, optional ntfy, and failures/timeouts. Test honeypot, duplicate-click behavior, validation errors, and rate limiting before switching traffic.
7. Review the public privacy policy before cutover: currently it describes **Go-owned SQLite storage** and minimal self-hosted ntfy. Once switched, submission data will be stored by HappyContact, the full message will be delivered through an external email relay, and copies will be in encrypted recovery backups. Update the policy to describe the actual processing and recipients rather than prematurely changing it now.
8. Retain/restore-test historical Go submissions. Keep the old ntfy settings for rollback; the Go send is automatically bypassed in HappyContact mode so it cannot duplicate HappyContact notifications.

## Rollback

1. Set `DEV_CONTACT_BACKEND=sqlite` (or unset it) in the Go service environment
   and restart the Go service. Keep the original `DEV_CONTACT_DB_PATH` pointing
   to its existing persistent database; never replace it with HappyContact's DB.
2. Confirm a test submission is saved in Go SQLite, appears in the existing
   private admin, redirects to `/contact-sent.html`, and uses the old optional
   ntfy settings if configured. HappyContact settings are ignored in this mode.
3. Retain HappyContact's database and inspect its accepted submissions and
   pending delivery jobs separately. Rollback affects new intake only; it does
   not migrate records or stop already queued HappyContact deliveries. A timed
   out request may already be stored there, so reconcile before manual resends.

Both modes open the historical Go database at startup and keep the optional
private Go admin available. No schema change, database deletion/migration, or
public admin route is part of this integration. The public privacy page remains
accurate for the default SQLite deployment; update it for actual recipients,
storage, SMTP relay, and backups before enabling HappyContact in production.

## Current HappyContact facts (verified November 4, 2026)

HappyContact is running on FrontDesk with public smoke endpoint `https://contact.kgivler.com` and a loopback API listener. Its separate WireGuard-only operator admin returned HTTP 404 through the public endpoint. The test site delivered ntfy and full Mailjet SMTP messages (with correct visitor `Reply-To`), and its independently configured operator ntfy worker alerted on a deliberately failed destination. FrontDesk's existing encrypted Restic job backs up the HappyContact database consistently and sends to three VPS destinations; a DeepDish restore of the database passed `PRAGMA integrity_check`.

These successes validate a **test site**, not the `dev.kgivler.com` integration. Both ntfy smoke tokens expire roughly November 11, 2026, so rotate before using for unattended operations.
