package main

import (
	"context"
	"fmt"
	"html"
	"html/template"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

func testAdminHandler(t *testing.T, store *contactStore) http.Handler {
	t.Helper()
	handler, err := newAdminHandler(store)
	if err != nil {
		t.Fatal(err)
	}
	return handler
}

func adminRequest(handler http.Handler, method, path string, form url.Values) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(form.Encode()))
	if form != nil {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, req)
	return response
}

func saveAdminContact(t *testing.T, store *contactStore, message contactMessage) int64 {
	t.Helper()
	id, err := store.save(context.Background(), message)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func adminCSRFToken(t *testing.T, handler http.Handler, id int64) string {
	t.Helper()
	response := adminRequest(handler, http.MethodGet, fmt.Sprintf("/admin/contact/%d", id), nil)
	if response.Code != http.StatusOK {
		t.Fatalf("detail failed: %d: %s", response.Code, response.Body.String())
	}
	match := regexp.MustCompile(`name="csrf_token" value="([0-9a-f]{64})"`).FindStringSubmatch(response.Body.String())
	if len(match) != 2 {
		t.Fatal("missing 256-bit form token")
	}
	return match[1]
}

func requireAdminStatus(t *testing.T, store *contactStore, id int64, want string) {
	t.Helper()
	contact, err := store.getContact(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	if contact.Status != want {
		t.Fatalf("status = %q, want %q", contact.Status, want)
	}
}

func TestAdminRouteIsolation(t *testing.T) {
	store, _ := newTestContactStore(t)
	public, err := newSiteHandler(store, nil)
	if err != nil {
		t.Fatal(err)
	}
	id := saveAdminContact(t, store, contactMessage{Name: "Alice", Email: "alice@example.com", Message: "Private message"})
	admin := testAdminHandler(t, store)
	token := adminCSRFToken(t, admin, id)
	for _, path := range []string{"/admin/contact", "/admin/contact/1", "/admin/style.css", "/admin/list.html", "/admin/detail.html", "/admin/layout.html"} {
		t.Run(path, func(t *testing.T) {
			response := adminRequest(public, http.MethodGet, path, nil)
			if response.Code != http.StatusNotFound || strings.Contains(response.Body.String(), "Private message") || strings.Contains(response.Body.String(), token) {
				t.Fatalf("public route exposed admin content: %d", response.Code)
			}
		})
	}
	response := adminRequest(public, http.MethodPost, "/admin/contact/1/status", url.Values{"csrf_token": {token}, "status": {"spam"}})
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("public status POST = %d, want 405", response.Code)
	}
	requireAdminStatus(t, store, id, "new")
	for _, path := range []string{"/admin/contact", "/admin/contact/1", "/admin/style.css"} {
		if response := adminRequest(admin, http.MethodGet, path, nil); response.Code != http.StatusOK {
			t.Errorf("admin GET %s = %d", path, response.Code)
		}
	}
	root := adminRequest(admin, http.MethodGet, "/", nil)
	if root.Code != http.StatusSeeOther || root.Header().Get("Location") != "/admin/contact" {
		t.Fatal("admin root did not redirect to contact list")
	}
}

func TestAdminListNewestFirstAndEscaping(t *testing.T) {
	store, _ := newTestContactStore(t)
	handler := testAdminHandler(t, store)
	empty := adminRequest(handler, http.MethodGet, "/admin/contact", nil)
	if empty.Code != http.StatusOK || !strings.Contains(empty.Body.String(), "No contact messages yet.") {
		t.Fatal("empty contact list did not render")
	}
	first := saveAdminContact(t, store, contactMessage{Name: "Earlier", Email: "earlier@example.com", Message: "older-body-not-listed"})
	malicious := `<script>alert("stored")</script>`
	second := saveAdminContact(t, store, contactMessage{Name: malicious, Email: malicious, Phone: malicious, Subject: malicious, Message: "newer-body-not-listed"})
	// Test escaping even if a legacy/manual database edit left an unexpected status.
	if _, err := store.db.Exec("UPDATE ContactMessages SET Status = ? WHERE Id = ?", malicious, second); err != nil {
		t.Fatal(err)
	}
	response := adminRequest(handler, http.MethodGet, "/admin/contact", nil)
	body := response.Body.String()
	if response.Code != http.StatusOK || strings.Contains(body, malicious) || strings.Count(body, template.HTMLEscapeString(malicious)) != 5 {
		t.Fatalf("list did not escape all stored fields: %s", body)
	}
	if strings.Index(body, fmt.Sprintf(">#%d</a>", second)) >= strings.Index(body, fmt.Sprintf(">#%d</a>", first)) {
		t.Fatal("contacts are not listed newest first")
	}
	if !strings.Contains(body, "(no subject)") || !strings.Contains(body, "—") || strings.Contains(body, "body-not-listed") {
		t.Fatal("optional fields or list body omission are incorrect")
	}
}

func TestAdminDetailCompleteAndEscaped(t *testing.T) {
	store, _ := newTestContactStore(t)
	message := contactMessage{
		Name: `<b>Alice</b>`, Email: `alice+<x>@example.com`, Phone: `+1 <555>`,
		Subject: `<img src=x onerror=alert(1)>`, Message: "First line\n<script>alert('stored')</script>\nLast line",
	}
	id := saveAdminContact(t, store, message)
	saved, err := store.getContact(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	handler := testAdminHandler(t, store)
	response := adminRequest(handler, http.MethodGet, fmt.Sprintf("/admin/contact/%d", id), nil)
	body := response.Body.String()
	for _, value := range []string{message.Name, message.Email, message.Phone, message.Subject, message.Message, saved.CreatedUtc} {
		if !strings.Contains(html.UnescapeString(body), value) || (strings.Contains(value, "<") && strings.Contains(body, value)) {
			t.Errorf("missing escaped detail field %q", value)
		}
	}
	if response.Code != http.StatusOK || strings.Contains(body, "<script>") || !strings.Contains(body, "Contact #"+strconv.FormatInt(id, 10)) {
		t.Fatal("detail page is incorrect or unsafe")
	}
	_ = adminCSRFToken(t, handler, id)
	// Viewing the message does not silently mark it read.
	requireAdminStatus(t, store, id, "new")
}

func TestAdminMissingAndInvalidIDs(t *testing.T) {
	store, _ := newTestContactStore(t)
	handler := testAdminHandler(t, store)
	for _, id := range []string{"999", "0", "-1", "nope", "999999999999999999999999"} {
		t.Run(id, func(t *testing.T) {
			if response := adminRequest(handler, http.MethodGet, "/admin/contact/"+id, nil); response.Code != http.StatusNotFound {
				t.Fatalf("missing/invalid ID returned %d", response.Code)
			}
		})
	}
}

func TestAdminStatusChangesPersist(t *testing.T) {
	store, path := newTestContactStore(t)
	id := saveAdminContact(t, store, contactMessage{Name: "Alice", Email: "alice@example.com", Message: "Help"})
	handler := testAdminHandler(t, store)
	token := adminCSRFToken(t, handler, id)
	for _, status := range []string{"read", "archived", "spam", "new"} {
		t.Run(status, func(t *testing.T) {
			response := adminRequest(handler, http.MethodPost, fmt.Sprintf("/admin/contact/%d/status", id), url.Values{"csrf_token": {token}, "status": {status}})
			if response.Code != http.StatusSeeOther || response.Header().Get("Location") != fmt.Sprintf("/admin/contact/%d", id) {
				t.Fatalf("status update = %d, location %q", response.Code, response.Header().Get("Location"))
			}
			requireAdminStatus(t, store, id, status)
			reopened, err := openContactStore(path)
			if err != nil {
				t.Fatal(err)
			}
			defer reopened.db.Close()
			requireAdminStatus(t, reopened, id, status)
		})
	}
}

func TestAdminInvalidStatusAndMissingContact(t *testing.T) {
	store, _ := newTestContactStore(t)
	id := saveAdminContact(t, store, contactMessage{Name: "Alice", Email: "alice@example.com", Message: "Help"})
	handler := testAdminHandler(t, store)
	token := adminCSRFToken(t, handler, id)
	for _, status := range []string{"", "deleted", "READ", "new'; DROP TABLE ContactMessages;--"} {
		t.Run("status/"+status, func(t *testing.T) {
			response := adminRequest(handler, http.MethodPost, "/admin/contact/1/status", url.Values{"csrf_token": {token}, "status": {status}})
			if response.Code != http.StatusBadRequest {
				t.Fatalf("invalid status returned %d", response.Code)
			}
			requireAdminStatus(t, store, id, "new")
		})
	}
	for _, missing := range []string{"999", "-1", "bad"} {
		t.Run("id/"+missing, func(t *testing.T) {
			response := adminRequest(handler, http.MethodPost, "/admin/contact/"+missing+"/status", url.Values{"csrf_token": {token}, "status": {"read"}})
			if response.Code != http.StatusNotFound {
				t.Fatalf("nonexistent contact returned %d", response.Code)
			}
		})
	}
	response := adminRequest(handler, http.MethodGet, "/admin/contact/1/status?status=spam&csrf_token="+token, nil)
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("GET status endpoint returned %d, want 405", response.Code)
	}
	requireAdminStatus(t, store, id, "new")
}

func TestAdminCSRF(t *testing.T) {
	store, _ := newTestContactStore(t)
	id := saveAdminContact(t, store, contactMessage{Name: "Alice", Email: "alice@example.com", Message: "Help"})
	handler := testAdminHandler(t, store)
	token := adminCSRFToken(t, handler, id)
	otherToken := adminCSRFToken(t, testAdminHandler(t, store), id)
	if token == otherToken {
		t.Fatal("handlers reused a CSRF token")
	}
	logs := captureContactLogs(t)
	for _, tc := range []struct{ name, token, query string }{
		{"missing", "", ""}, {"incorrect", strings.Repeat("0", 64), ""},
		{"previous-process", otherToken, ""}, {"query-only", "", "?csrf_token=" + token},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response := adminRequest(handler, http.MethodPost, "/admin/contact/1/status"+tc.query, url.Values{"csrf_token": {tc.token}, "status": {"spam"}})
			if response.Code != http.StatusForbidden || strings.Contains(response.Body.String(), token) {
				t.Fatalf("bad CSRF response: %d", response.Code)
			}
			requireAdminStatus(t, store, id, "new")
		})
	}
	page := adminRequest(handler, http.MethodGet, "/admin/contact/1", nil).Body.String()
	for _, attr := range regexp.MustCompile(`(?:href|action)="[^"]*"`).FindAllString(page, -1) {
		if strings.Contains(attr, token) {
			t.Fatal("token placed in URL")
		}
	}
	response := adminRequest(handler, http.MethodPost, "/admin/contact/1/status", url.Values{"csrf_token": {token}, "status": {"read"}})
	if response.Code != http.StatusSeeOther || strings.Contains(response.Header().Get("Location"), token) || strings.Contains(logs.String(), token) {
		t.Fatal("valid CSRF failed or leaked into redirects/logs")
	}
	requireAdminStatus(t, store, id, "read")
}

func TestAdminSecurityHeadersAndGenericFailures(t *testing.T) {
	store, path := newTestContactStore(t)
	id := saveAdminContact(t, store, contactMessage{Name: "Alice", Email: "alice@example.com", Message: "Help"})
	handler := testAdminHandler(t, store)
	token := adminCSRFToken(t, handler, id)
	for _, route := range []string{"/", "/admin/contact", "/admin/contact/1", "/admin/style.css", "/missing"} {
		response := adminRequest(handler, http.MethodGet, route, nil)
		for key, want := range map[string]string{"Cache-Control": "no-store", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff"} {
			if response.Header().Get(key) != want {
				t.Errorf("%s missing %s", route, key)
			}
		}
		if !strings.Contains(response.Header().Get("Content-Security-Policy"), "default-src 'none'") {
			t.Errorf("%s missing CSP", route)
		}
	}
	if err := store.db.Close(); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/admin/contact"}, {http.MethodGet, "/admin/contact/1"}, {http.MethodPost, "/admin/contact/1/status"},
	} {
		response := adminRequest(handler, tc.method, tc.path, url.Values{"csrf_token": {token}, "status": {"read"}})
		if response.Code != http.StatusInternalServerError || strings.Contains(response.Body.String(), path) || strings.Contains(response.Body.String(), "database is closed") {
			t.Fatalf("database failure returned unsafe response: %d %s", response.Code, response.Body.String())
		}
		if response.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("error response missing private headers")
		}
	}
}

func TestAdminStatusBodyLimit(t *testing.T) {
	store, _ := newTestContactStore(t)
	id := saveAdminContact(t, store, contactMessage{Name: "Alice", Email: "alice@example.com", Message: "Help"})
	handler := testAdminHandler(t, store)
	response := adminRequest(handler, http.MethodPost, "/admin/contact/1/status", url.Values{"csrf_token": {adminCSRFToken(t, handler, id)}, "status": {"spam"}, "extra": {strings.Repeat("x", 8<<10)}})
	if response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized status POST returned %d", response.Code)
	}
	requireAdminStatus(t, store, id, "new")
}
