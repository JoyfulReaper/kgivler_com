package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newTestContactStore(t *testing.T) (*contactStore, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "contact.db")
	store, err := openContactStore(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.db.Close() })
	return store, path
}

func validContactForm() url.Values {
	return url.Values{
		"name":    {"  Alex Example  "},
		"email":   {"  alex@example.com  "},
		"message": {"  Can you help with my website?  "},
	}
}

func postContact(t *testing.T, store *contactStore, body string) *httptest.ResponseRecorder {
	t.Helper()
	handler, err := newSiteHandler(store, nil)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/contact", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	return recorder
}

func requireContactCount(t *testing.T, store *contactStore, want int) {
	t.Helper()
	var count int
	if err := store.db.QueryRow("SELECT COUNT(*) FROM ContactMessages").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != want {
		t.Fatalf("stored messages = %d, want %d", count, want)
	}
}

func requireContactSuccess(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()
	if response.Code != http.StatusSeeOther || response.Header().Get("Location") != "/contact-sent.html" {
		t.Fatalf("response = %d, Location %q; want 303 to confirmation page", response.Code, response.Header().Get("Location"))
	}
}

func requireContactFailure(t *testing.T, response *httptest.ResponseRecorder, status int) {
	t.Helper()
	if response.Code != status {
		t.Fatalf("status = %d, want %d; body: %s", response.Code, status, response.Body.String())
	}
	if location := response.Header().Get("Location"); location != "" {
		t.Fatalf("failed submission redirected to %q", location)
	}
}

func TestContactValidSubmissionPersists(t *testing.T) {
	store, path := newTestContactStore(t)
	form := validContactForm()
	// Store literal punctuation/markup without SQL interpolation or HTML echoing.
	form.Set("message", "  Please fix O'Reilly's <script>alert(1)</script> example.  ")
	before := time.Now().UTC()
	response := postContact(t, store, form.Encode())
	after := time.Now().UTC()
	requireContactSuccess(t, response)
	if strings.Contains(response.Body.String(), "<script>") {
		t.Fatal("response echoed submitted markup")
	}
	if err := store.db.Close(); err != nil {
		t.Fatal(err)
	}

	// Reopening also exercises CREATE TABLE IF NOT EXISTS on an existing database.
	reopened, err := openContactStore(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.db.Close()
	requireContactCount(t, reopened, 1)
	var id int64
	var created, status string
	var saved contactMessage
	err = reopened.db.QueryRow(`SELECT Id, CreatedUtc, Name, Email, Phone, Subject, Message, Status
		FROM ContactMessages`).Scan(&id, &created, &saved.Name, &saved.Email, &saved.Phone,
		&saved.Subject, &saved.Message, &status)
	if err != nil {
		t.Fatal(err)
	}
	want := contactMessage{
		Name: "Alex Example", Email: "alex@example.com",
		Message: "Please fix O'Reilly's <script>alert(1)</script> example.",
	}
	if saved != want || id <= 0 || status != "new" {
		t.Fatalf("stored record = %#v, id = %d, status = %q", saved, id, status)
	}
	createdAt, err := time.Parse(time.RFC3339Nano, created)
	if err != nil || !strings.HasSuffix(created, "Z") || createdAt.Before(before) || createdAt.After(after) {
		t.Fatalf("unexpected CreatedUtc %q (parse error: %v)", created, err)
	}

	// Follow the redirect as a browser would; refreshing the GET cannot insert again.
	handler, err := newSiteHandler(reopened, nil)
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		page := httptest.NewRecorder()
		handler.ServeHTTP(page, httptest.NewRequest(http.MethodGet, response.Header().Get("Location"), nil))
		if page.Code != http.StatusOK || !strings.Contains(page.Body.String(), "Your message has been received.") {
			t.Fatalf("confirmation GET = %d: %s", page.Code, page.Body.String())
		}
	}
	requireContactCount(t, reopened, 1)
}

func TestContactOptionalPhoneAndSubject(t *testing.T) {
	for _, tc := range []struct {
		name, phone, subject string
		include              bool
	}{
		{name: "omitted"},
		{name: "blank", phone: " \t ", subject: " \n ", include: true},
		{name: "supplied", phone: "  +44 (0)20 1234 5678 ext. 9  ", subject: "  Website help  ", include: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store, _ := newTestContactStore(t)
			form := validContactForm()
			if tc.include {
				form.Set("phone", tc.phone)
				form.Set("subject", tc.subject)
			}
			requireContactSuccess(t, postContact(t, store, form.Encode()))
			requireContactCount(t, store, 1)
			var phone, subject string
			if err := store.db.QueryRow("SELECT Phone, Subject FROM ContactMessages").Scan(&phone, &subject); err != nil {
				t.Fatal(err)
			}
			if phone != strings.TrimSpace(tc.phone) || subject != strings.TrimSpace(tc.subject) {
				t.Fatalf("phone = %q, subject = %q; want trimmed optional fields", phone, subject)
			}
		})
	}
}

func TestContactRequiredFields(t *testing.T) {
	for _, field := range []string{"name", "email", "message"} {
		for _, blank := range []bool{false, true} {
			name := field + "/missing"
			if blank {
				name = field + "/whitespace"
			}
			t.Run(name, func(t *testing.T) {
				store, _ := newTestContactStore(t)
				form := validContactForm()
				form.Del(field)
				if blank {
					form.Set(field, " \t\r\n ")
				}
				requireContactFailure(t, postContact(t, store, form.Encode()), http.StatusBadRequest)
				requireContactCount(t, store, 0)
			})
		}
	}
}

func TestContactOversizedFields(t *testing.T) {
	for _, tc := range []struct {
		field string
		limit int
	}{
		{"name", 100}, {"email", 254}, {"phone", 50}, {"subject", 200}, {"message", 5000},
	} {
		t.Run(tc.field, func(t *testing.T) {
			store, _ := newTestContactStore(t)
			form := validContactForm()
			form.Set(tc.field, strings.Repeat("a", tc.limit+1))
			requireContactFailure(t, postContact(t, store, form.Encode()), http.StatusBadRequest)
			requireContactCount(t, store, 0)
		})
	}
}

func TestContactInvalidEmail(t *testing.T) {
	for _, email := range []string{"not-an-email", "Alex <alex@example.com>", "alex@example.com,other@example.com", "alex@example.com\r\nBcc: other@example.com"} {
		t.Run(email, func(t *testing.T) {
			store, _ := newTestContactStore(t)
			form := validContactForm()
			form.Set("email", email)
			requireContactFailure(t, postContact(t, store, form.Encode()), http.StatusBadRequest)
			requireContactCount(t, store, 0)
		})
	}
}

func TestContactOversizedBody(t *testing.T) {
	store, _ := newTestContactStore(t)
	// An unknown field must still count toward the overall body limit.
	body := validContactForm().Encode() + "&extra=" + strings.Repeat("a", maxContactBody)
	requireContactFailure(t, postContact(t, store, body), http.StatusRequestEntityTooLarge)
	requireContactCount(t, store, 0)
}

func TestContactHoneypot(t *testing.T) {
	for _, requiredPresent := range []bool{true, false} {
		name := "valid-fields"
		if !requiredPresent {
			name = "missing-fields"
		}
		t.Run(name, func(t *testing.T) {
			store, _ := newTestContactStore(t)
			form := url.Values{"website": {"  https://example.com  "}}
			if requiredPresent {
				form = validContactForm()
				form.Set("website", "  https://example.com  ")
			}
			requireContactSuccess(t, postContact(t, store, form.Encode()))
			requireContactCount(t, store, 0)
		})
	}
}

func TestContactStorageFailure(t *testing.T) {
	store, path := newTestContactStore(t)
	if err := store.db.Close(); err != nil {
		t.Fatal(err)
	}
	response := postContact(t, store, validContactForm().Encode())
	requireContactFailure(t, response, http.StatusInternalServerError)
	if !strings.Contains(response.Body.String(), "Your message could not be saved.") {
		t.Fatal("missing clear failure message")
	}
	if strings.Contains(response.Body.String(), path) || strings.Contains(response.Body.String(), "database is closed") {
		t.Fatal("response exposed internal storage details")
	}
	reopened, err := openContactStore(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.db.Close()
	requireContactCount(t, reopened, 0)
}
