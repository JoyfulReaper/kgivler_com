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

This step stores messages only: there are no notifications or admin screens.
Arrange a way to review the database until a later step adds those features.
Existing `DEV_SITE_LISTEN` and `MISSION_CONTROL_*` settings still apply.

## Checks

From `dev/src`:

```sh
gofmt -w *.go
CGO_ENABLED=0 go test ./...
CGO_ENABLED=0 go build ./...
```
