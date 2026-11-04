# Planned dev.kgivler.com contact form integration with HappyContact

**Status: design/transition plan only — not implemented.** The Go contact form, its SQLite store and its optional ntfy notification remain the live implementation until an explicit, tested cutover.

## Current flow (preserve until validated)

`POST /contact` is a same-origin, `application/x-www-form-urlencoded` form handled by the Go service in `src/contact.go`. It enforces input limits/validation, rejects the `contact_guard` honeypot, rate-limits accepted submissions, stores data in the Go service's SQLite database, optionally sends a minimal ntfy notification, then issues HTTP 303 to `/contact-sent.html`. The form works without JavaScript; the optional frontend script only improves submit-state UX. A separate private WireGuard admin listener lists and manages historical Go contact submissions.

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
2. Implement a small, bounded-timeout Go-to-HappyContact JSON client behind an explicit server-side opt-in flag/configuration. The exact config names are **not implemented yet**. Store the HappyContact site ID and base URL in protected server config, never in browser scripts. Do not log submissions or provider credentials.
3. Map existing `name`, `email`, optional `phone`/`subject`, and `message` fields exactly; retain local validation and its useful error UX. Map HappyContact `202` to the same 303 success redirect; handle 4xx, 429, 503, timeouts, and unreachable API without claiming the message was saved. Honor bounded timeouts relative to the Go server's 10-second write timeout.
4. **Do not silently dual-write** to Go SQLite and HappyContact or automatically fall back to the old store after an uncertain upstream timeout; either can cause duplicate/misleading messages. Plan an explicit, reversible cutover and preserve the old database for rollback/historical access.
5. Review how the actual visitor IP reaches HappyContact through the loopback Go proxy. HappyContact rate limits by IP/site/global and trusts `CF-Connecting-IP` only from loopback. Do not forward arbitrary untrusted client-supplied IP headers; validate at the trusted ingress boundary. Browser CORS is not needed for a same-origin form.
6. Test a real submission end-to-end: browser submit/redirect, HappyContact receipt and SQLite jobs, full SMTP email with correct visitor `Reply-To`, optional ntfy, and failures/timeouts. Test honeypot, duplicate-click behavior, validation errors, and rate limiting before switching traffic.
7. Review the public privacy policy before cutover: currently it describes **Go-owned SQLite storage** and minimal self-hosted ntfy. Once switched, submission data will be stored by HappyContact, the full message will be delivered through an external email relay, and copies will be in encrypted recovery backups. Update the policy to describe the actual processing and recipients rather than prematurely changing it now.
8. Retain/restore-test historical Go submissions and document the rollback procedure. Remove the old Go ntfy send only when HappyContact delivery is proven so a single contact doesn't generate duplicate notifications.

## Current HappyContact facts (verified November 4, 2026)

HappyContact is running on FrontDesk with public smoke endpoint `https://contact.kgivler.com` and a loopback API listener. Its separate WireGuard-only operator admin returned HTTP 404 through the public endpoint. The test site delivered ntfy and full Mailjet SMTP messages (with correct visitor `Reply-To`), and its independently configured operator ntfy worker alerted on a deliberately failed destination. FrontDesk's existing encrypted Restic job backs up the HappyContact database consistently and sends to three VPS destinations; a DeepDish restore of the database passed `PRAGMA integrity_check`.

These successes validate a **test site**, not the `dev.kgivler.com` integration. Both ntfy smoke tokens expire roughly November 11, 2026, so rotate before using for unattended operations.
