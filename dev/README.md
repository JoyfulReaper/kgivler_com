# Development-services Go service

Run `go run .` from `dev/src` with Go 1.25 or newer. The service keeps its
`net/http` server and embedded static frontend; no JavaScript is needed to submit
the contact form. Optional `contact-submit.js` disables the submit button and
shows a spinner on valid form submission to discourage duplicate sends. The
button resets on browser back/forward navigation.

## Budget static hosting offer

The public service description is `src/static/hosting/index.html` (served at
`https://dev.kgivler.com/hosting/`). Homepage, website packages, and FAQ link
to it. These are **marketing/information pages only**; the Go dev-site process
is not the planned multi-customer static hosting platform.

The agreed phase-one service boundaries are recorded in
[HOSTING_PHASE1.md](HOSTING_PHASE1.md), with broader site guidance in
[DEVELOPMENT_SERVICES_PLAN.md](DEVELOPMENT_SERVICES_PLAN.md). In particular:
$149/year, static files only, no uptime SLA, no included customer backups,
14-day renewal grace period, no guaranteed support times or post-termination
data recovery, and one minor annual content update.

Draft public pages for [hosting terms](src/static/hosting/terms/index.html)
and [site privacy](src/static/privacy/index.html) now accompany the hosting
offer. The privacy page documents actual contact-form storage, IP-based
server logging, homepage telemetry, and optional ntfy notifications.

**Before accepting paid hosting customers**, have these documents reviewed for
your situation, publish them, ensure customers explicitly accept the hosting
terms in the sales process, and settle fair-use limits, renewal notices,
data retention/security, and support/termination procedures. The contact
database currently has no automatic deletion schedule; do not imply otherwise.
Do not describe HappyPages or HappyPortal features as live before they exist.

## Opt-in HappyContact backend (not deployed)

The Go `POST /contact` handler defaults to **SQLite and the existing optional ntfy
notification**. Deploying this code without changing configuration keeps that
behavior. The form still posts to `/contact`; its submit script, honeypot, local
rate limit, no-JavaScript flow, confirmation page, and HTTP 303 redirect remain.
Phone validation and Unicode subject/email limits now match HappyContact before
either backend is called; see the input rules below.

Server-side environment settings:

| Setting | Behavior |
| --- | --- |
| `DEV_CONTACT_BACKEND` | Unset, empty, or `sqlite` uses the existing store. `happycontact` opts in. Other values stop startup. |
| `DEV_HAPPYCONTACT_BASE_URL` | Required in HappyContact mode; loopback HTTP(S) origin, e.g. `http://127.0.0.1:5290`. Literal loopback IP only; no credentials, path, query, or fragment. |
| `DEV_HAPPYCONTACT_SITE_ID` | Required nonzero GUID for a newly provisioned `dev.kgivler.com` site. No default or smoke-test site ID. |
| `DEV_CONTACT_TRUST_CLOUDFLARE_PROXY` | Defaults to `false`. Enable only after verifying the trusted ingress described below. |

HappyContact receives JSON at `/api/v1/sites/{siteId}/submissions` with the trimmed
`name`, `email`, optional `phone`/`subject`, and `message`. Empty optional fields
are omitted; no honeypot value or browser headers are copied. The client makes
one request with a three-second timeout and the incoming request context, with
no redirects, retries, or environment HTTP proxy. Only **202 Accepted** triggers
the existing success redirect; acceptance confirms storage, not SMTP delivery.

Upstream 400/422 returns a generic HTTP 400 page, 429 returns 429 with fixed
`Retry-After: 60`, and 503 returns 503. Other non-202 statuses return 502;
unreachable/transport failures return 503, and timeouts return 504. Response
bodies, raw transport errors, URLs, site IDs, and contact fields are not logged
by the client or echoed in error pages. A timeout may occur after upstream
storage: there is **no automatic retry, SQLite fallback, or dual write**.
In this mode the old Go ntfy notifier is bypassed even if configured;
HappyContact owns delivery. Failed valid attempts still consume the local limit.

In HappyContact mode, the socket peer IP identifies the visitor for both the
local limiter and the outbound `CF-Connecting-IP` header. With proxy trust
enabled, a **single parseable `CF-Connecting-IP` from a loopback peer** overrides
it. `X-Real-IP`, `X-Forwarded-For`, `Forwarded`, malformed/list/duplicate CF
headers, and forwarding headers from non-loopback callers are ignored. Enable
trust only when the Go listener is reachable solely through trusted local
ingress and cloudflared overwrites the CF header. A loopback connection alone
does not authenticate a proxy. Without trust enabled, tunneled visitors share
the proxy IP and its rate-limit budget. Existing SQLite-mode IP handling,
request logging, and telemetry are unchanged.

The shared Go validator now checks HappyContact's phone and string-length rules
locally, including in SQLite mode. This intentionally narrows the previously
accepted free-text phone field; historical stored records are unchanged.

`DEV_CONTACT_DB_PATH` and `DEV_ADMIN_LISTEN` remain active in both modes: the
historical SQLite store is still opened at startup and the optional private
admin can read/change its records. New HappyContact submissions are managed in
HappyContact's separate private admin, not the Go admin.

See [HAPPYCONTACT-INTEGRATION.md](HAPPYCONTACT-INTEGRATION.md) for the remaining
site setup, end-to-end checks, privacy update, and explicit rollback procedure.
This change does not alter deployment, the tunnel, or the HappyContact service.

## Contact storage

`DEV_CONTACT_DB_PATH` selects the SQLite file. The development default is
`data/contact.db`, relative to the process working directory. The service creates
parent directories and the `ContactMessages` table automatically. Newly created
directories/files use Unix permissions 0700/0600. Initialization failures stop
startup; submission write failures return HTTP 500 with no success redirect.

The table has `Id INTEGER PRIMARY KEY AUTOINCREMENT`, `CreatedUtc TEXT` (UTC
RFC3339 with fractional seconds), `Name TEXT`, `Email TEXT`, `Phone TEXT`,
`Subject TEXT`, `Message TEXT`, and `Status TEXT DEFAULT 'new'`. All columns are
non-null; omitted phone and subject are stored as empty strings. No IP address
or request metadata is stored in a contact record.

`POST /contact` accepts URL-encoded forms up to 64 KiB, trims values, and requires
name, email, and message. Limits remain 100 Unicode characters for name,
254 for email, and 5,000 for message. Subject is limited to 200 UTF-16 units,
matching .NET and HTML `maxlength`: symbols outside the BMP count as two.
Email also has HappyContact's 320-UTF-16-unit cap. Name/message limits already
fit HappyContact's 200/10,000-unit caps; those inputs are not further restricted.
The browser's `maxlength` can still be stricter than the server for name,
email, and message containing supplementary characters. Email must parse as a
single bare address, as before.

Phone is optional, with a **40-character maximum** in both HTML and Go (formerly
50). Validation matches HappyContact's .NET 10 `[Phone]` and `[StringLength(40)]`:
the main number needs at least one decimal digit and permits Unicode whitespace,
`-`, `.`, `(`, and `)`. Decimal digits within the BMP, including Arabic and
fullwidth digits, are accepted; supplementary-plane digits are not. An optional
case-insensitive `x`, `ext`, or `ext.` suffix must have one or more decimal digits
after optional leading whitespace, with no spaces/punctuation between those
extension digits. Plus signs are ignored **only while checking format** and
still count toward the length limit. There is no country-specific digit count or
parenthesis-balancing rule. Vanity letters, `/`, `#` extensions, and missing or
malformed extension digits are rejected locally with an example and the option
to leave phone blank. Omitted/whitespace-only phone remains optional.

These intentional restrictions apply in both backend modes so rollback keeps
the same form behavior. Apart from the existing outer-whitespace trimming, no
phone formatting is rewritten, truncated, or discarded. Rules were checked
against HappyContact's `dev` [submission contract](https://github.com/JoyfulReaper/HappyContact/blob/dev/src/HappyContact.Core/Contracts/SubmitContactRequest.cs),
the .NET [PhoneAttribute implementation](https://github.com/dotnet/runtime/blob/v10.0.0/src/libraries/System.ComponentModel.Annotations/src/System/ComponentModel/DataAnnotations/PhoneAttribute.cs),
and a local .NET 10.0.14 runtime probe. Ordinary upstream site/queue/rate-limit
rejections can still occur even for valid input.

Invalid input returns HTTP 400, excessive bodies 413, and unsupported form media
types 415. The hidden `contact_guard` honeypot returns HTTP 400 without storage
when filled. Saved messages redirect with HTTP 303 to the embedded
`/contact-sent.html` page. An unrelated `website` autofill field is ignored.
No submitted values are echoed into response HTML.

Before deployment, set an absolute database path on persistent local storage
outside the checkout and static directory, grant the service user access, and
decide backup and retention policies. SQLite needs directory write access for
its journal. Use a SQLite-aware backup or stop the service before copying the
database. Existing file permissions remain the operator's responsibility.

The optional private admin listener can display complete submissions and change
their status; notifications do not contain the complete contact submission.
Existing `DEV_SITE_LISTEN` and `MISSION_CONTROL_*` settings still apply.

## Contact rate limit

Only valid `POST /contact` submissions consume the in-memory limit: five accepted
attempts per client in a fixed 15-minute window starting with the first attempt.
The check runs before either backend call; a failed write/request still consumes an attempt.
Excess attempts receive HTTP 429 with a human-readable page and `Retry-After`
seconds. Invalid forms retain their validation responses, and honeypot submissions
return HTTP 400 without consuming limiter state.

SQLite-mode client identification uses the existing `requestRemoteHost` helper,
including its forwarding-header handling for loopback proxies. HappyContact mode
uses the stricter IP handling described above. Client strings are kept only
in limiter memory, with expired entries removed on each valid submission attempt.
The limiter resets at process restart and is local to each service process. No IP
fields or other schema changes are added to SQLite. Existing request logging and
Mission Control telemetry behavior are unchanged.

## Optional contact notifications

- `DEV_CONTACT_NTFY_URL`: the full server-side ntfy publish URL, including topic.
  Empty or unset disables notifications.
- `DEV_CONTACT_NTFY_TOKEN`: optional bearer token; unset means no Authorization
  header is sent.

Set these in the service environment, never in frontend files or committed
configuration. Use an HTTPS publish URL for a remote server and restrict access
to the topic as appropriate. No changes are needed to keep notifications disabled.

In SQLite mode only, after SQLite saves a message, the service makes one plain-text HTTP POST with
the fixed `Title: New dev.kgivler.com contact` header. The body includes the saved
message ID, name, and subject (or `(no subject)`). Control characters in name and
subject are replaced with spaces; neither value is used in HTTP headers. Email,
phone, and message-body fields are omitted.

Publishing is best-effort, with a two-second HTTP timeout and no retries or
redirect following. A submission may wait up to that timeout for its one publish
attempt. Any notification failure logs only a generic failure or HTTP status and
still returns the normal success redirect with the stored record intact. Publish
URLs, tokens, response bodies, and contact content are never included in those
logs. There is no notification queue, so failed notifications are not replayed.

## Private contact admin

`DEV_ADMIN_LISTEN` enables a separate HTTP server and ServeMux. Empty or unset
means no admin handler/server/socket is created. For local development only,
`127.0.0.1:5197` or `[::1]:5197` can be used.

The value must be a literal IP and numeric port from 1 to 65535. IPv6 must use
brackets. Only loopback, RFC1918 IPv4, and IPv6 ULA addresses are accepted;
IPv4-mapped IPv6 addresses are checked as IPv4. Hostnames, wildcards, unspecified,
public, link-local, multicast, scoped/zone addresses, and port zero are rejected.
Whitespace is not silently trimmed. A configured listener that cannot bind stops
startup; there is no fallback address.

For production, bind to the host's **exact private/WireGuard interface address**,
never a wildcard or public address. WireGuard is the access boundary: this UI
intentionally has no separate account or login system. Address validation cannot
verify that a private address belongs to WireGuard rather than a LAN; choose the
interface and network/firewall access deliberately. Keep this listener off public
ingress. No public admin routes or proxy are added to `DEV_SITE_LISTEN`.

The private routes are:

- `GET /` redirects to `/admin/contact`.
- `GET /admin/contact` lists messages in descending insertion-ID order.
- `GET /admin/contact/{id}` shows a complete message without changing its status.
- `POST /admin/contact/{id}/status` accepts `new`, `read`, `archived`, or `spam`,
  then redirects to the detail page. There is no delete action.
- `GET /admin/style.css` serves the private stylesheet.

Templates and CSS are embedded separately from public static files. All stored
content is escaped by `html/template`. Responses include `Cache-Control: no-store`,
`X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `nosniff`, and a restrictive
CSP allowing only the local stylesheet and same-origin forms. No JavaScript,
external assets, credentials, database paths, or environment settings are shown.

Each admin handler generates a random 256-bit CSRF token at startup. Status forms
include it as a hidden field and POSTs compare it in constant time; missing or
incorrect tokens return 403. Tokens in query strings do not authorize changes.
Restarting the service invalidates open forms; reload the detail page before
submitting again. Status form bodies are limited to 8 KiB. Admin requests are not
sent through public request logging or Mission Control telemetry. The existing
SQLite schema and public contact behavior are unchanged.

## Checks

From `dev/src`:

```sh
gofmt -w *.go
go mod tidy
CGO_ENABLED=0 go test -v ./...
CGO_ENABLED=0 go build ./...
```

Run the optional frontend submit-state tests from the repository root:

```sh
node --test dev/tests/contact-submit.test.cjs
```
