# Development-services Go service

Run `go run .` from `dev/src` with Go 1.25 or newer. The service keeps its
`net/http` server and embedded static frontend; no JavaScript is needed to submit
the contact form.

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
name, email, and message. Maximum Unicode character counts are 100 for name,
254 for email, 50 for phone, 200 for subject, and 5,000 for message. The browser's
`maxlength` may be stricter for characters represented by UTF-16 surrogate pairs.
Email must parse as a single bare address; phone is only trimmed and length-bound.
Invalid input returns HTTP 400, excessive bodies 413, and unsupported form media
types 415. The hidden `website` honeypot skips storage when filled. Both saved
messages and honeypot submissions redirect with HTTP 303 to the embedded
`/contact-sent.html` page. No submitted values are echoed into response HTML.

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
The check runs before SQLite writes; a failed write still consumes an attempt.
Excess attempts receive HTTP 429 with a human-readable page and `Retry-After`
seconds. Invalid forms retain their validation responses, and honeypot submissions
retain their fake-success redirect without consuming limiter state.

Client identification uses the existing `requestRemoteHost` helper, including
its forwarding-header handling for loopback proxies. Client strings are kept only
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

After SQLite saves a message, the service makes one plain-text HTTP POST with
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
