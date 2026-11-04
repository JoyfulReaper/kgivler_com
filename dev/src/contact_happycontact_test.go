package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const testHappyContactSiteID = "8ffb8460-3bea-4f91-a604-cbb969b2c709" // Synthetic; not a provisioned site.

func testHappyContactClient(t *testing.T, baseURL string) *happyContactClient {
	t.Helper()
	t.Setenv("DEV_CONTACT_BACKEND", "happycontact")
	t.Setenv("DEV_HAPPYCONTACT_BASE_URL", baseURL)
	t.Setenv("DEV_HAPPYCONTACT_SITE_ID", testHappyContactSiteID)
	t.Setenv("DEV_CONTACT_TRUST_CLOUDFLARE_PROXY", "false")
	client, err := happyContactFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(client.client.CloseIdleConnections)
	return client
}

func testHappyContactHandler(t *testing.T, store *contactStore, client *happyContactClient) http.Handler {
	t.Helper()
	// Enabling HappyContact must bypass this old notifier, including on failure.
	notifier := newContactNotifier("http://unused.invalid/secret-topic", "secret-token")
	notifier.client.Transport = contactRoundTripFunc(func(*http.Request) (*http.Response, error) {
		t.Error("HappyContact mode used the old ntfy notifier")
		return nil, fmt.Errorf("unexpected notification")
	})
	handler, err := newSiteHandler(store, notifier, client)
	if err != nil {
		t.Fatal(err)
	}
	return handler
}

func TestHappyContactSuccess(t *testing.T) {
	for _, optional := range []bool{false, true} {
		t.Run(fmt.Sprint(optional), func(t *testing.T) {
			store, _ := newTestContactStore(t)
			historicalID := saveAdminContact(t, store, contactMessage{Name: "Earlier", Email: "old@example.com", Message: "Historical inquiry"})
			var attempts atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				attempts.Add(1)
				if r.Method != http.MethodPost || r.URL.Path != "/api/v1/sites/"+testHappyContactSiteID+"/submissions" || r.Header.Get("Content-Type") != "application/json" {
					t.Error("unexpected API route, method, or content type")
				}
				var payload map[string]string
				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					t.Error(err)
				}
				want := map[string]string{"name": "Alex Example", "email": "alex@example.com", "message": "Can you help with my website?"}
				if optional {
					want["phone"], want["subject"] = "+1 555 0100", "Website help"
				}
				if !maps.Equal(payload, want) {
					t.Errorf("payload = %v, want %v", payload, want)
				}
				if r.Header.Get("CF-Connecting-IP") != "192.0.2.1" || r.Header.Get("X-Real-IP") != "" || r.Header.Get("X-Forwarded-For") != "" {
					t.Error("unexpected visitor headers")
				}
				w.WriteHeader(http.StatusAccepted)
				// Acceptance depends on status, never receipt/body parsing.
				fmt.Fprint(w, "not JSON; private receipt")
			}))
			defer server.Close()
			client := testHappyContactClient(t, server.URL+"/")
			handler := testHappyContactHandler(t, store, client)
			form := validContactForm()
			form.Set("website", "https://autofill.example") // Never forward HappyContact's honeypot.
			if optional {
				form.Set("phone", "  +1 555 0100  ")
				form.Set("subject", "  Website help  ")
			}
			response := submitContact(handler, form, "192.0.2.1:1234")
			requireContactSuccess(t, response)
			if attempts.Load() != 1 || response.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("expected one submission and uncached response")
			}
			page := httptest.NewRecorder()
			handler.ServeHTTP(page, httptest.NewRequest(http.MethodGet, response.Header().Get("Location"), nil))
			if page.Code != http.StatusOK || !strings.Contains(page.Body.String(), "Your message has been received.") {
				t.Fatal("existing confirmation page unavailable")
			}
			// No dual write; the original private admin still reads historical data.
			requireContactCount(t, store, 1)
			admin := testAdminHandler(t, store)
			page = httptest.NewRecorder()
			admin.ServeHTTP(page, httptest.NewRequest(http.MethodGet, fmt.Sprintf("/admin/contact/%d", historicalID), nil))
			if page.Code != http.StatusOK || !strings.Contains(page.Body.String(), "Historical inquiry") {
				t.Fatal("historical private admin submission unavailable")
			}
		})
	}
}

func TestHappyContactRejectsEveryNon202(t *testing.T) {
	for _, tc := range []struct{ upstream, want int }{
		{200, 502}, {201, 502}, {204, 502}, {307, 502}, {308, 502},
		{400, 400}, {401, 502}, {403, 502}, {404, 502}, {422, 400}, {429, 429}, {500, 502}, {503, 503},
	} {
		t.Run(fmt.Sprint(tc.upstream), func(t *testing.T) {
			store, _ := newTestContactStore(t)
			logs := captureContactLogs(t)
			var attempts atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				attempts.Add(1)
				w.Header().Set("Location", "/must-not-follow")
				w.Header().Set("Retry-After", "private-upstream-data")
				w.WriteHeader(tc.upstream)
				fmt.Fprint(w, "sensitive response")
			}))
			defer server.Close()
			client := testHappyContactClient(t, server.URL)
			response := submitContact(testHappyContactHandler(t, store, client), validContactForm(), "192.0.2.1:1234")
			requireContactFailure(t, response, tc.want)
			requireContactCount(t, store, 0)
			if attempts.Load() != 1 {
				t.Fatal("request retried or followed a redirect")
			}
			if tc.want == 429 && response.Header().Get("Retry-After") != "60" {
				t.Fatal("missing bounded local retry guidance")
			}
			for _, secret := range []string{server.URL, testHappyContactSiteID, "sensitive response", "private-upstream-data", "alex@example.com", "Can you help with my website?"} {
				if strings.Contains(logs.String()+response.Body.String()+fmt.Sprint(response.Header()), secret) {
					t.Fatalf("failure exposed private value %q", secret)
				}
			}
		})
	}
}

func TestHappyContactOutageAndTimeout(t *testing.T) {
	for _, failure := range []string{"outage", "timeout", "transport-error", "parent-deadline"} {
		t.Run(failure, func(t *testing.T) {
			store, _ := newTestContactStore(t)
			logs := captureContactLogs(t)
			var attempts atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				attempts.Add(1)
				_, _ = io.Copy(io.Discard, r.Body)
				<-r.Context().Done()
			}))
			defer server.Close()
			client := testHappyContactClient(t, server.URL)
			if client.client.Timeout != 3*time.Second || client.client.Transport.(*http.Transport).Proxy != nil {
				t.Fatal("expected bounded timeout and no environment proxy")
			}
			want := http.StatusGatewayTimeout
			switch failure {
			case "outage":
				server.Close()
				want = http.StatusServiceUnavailable
			case "transport-error":
				client.client.Transport = contactRoundTripFunc(func(*http.Request) (*http.Response, error) {
					attempts.Add(1)
					return nil, fmt.Errorf("secret-token sensitive response")
				})
				want = http.StatusServiceUnavailable
			case "timeout":
				client.client.Timeout = 30 * time.Millisecond
			}
			handler := testHappyContactHandler(t, store, client)
			req := httptest.NewRequest(http.MethodPost, "/contact", strings.NewReader(validContactForm().Encode()))
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			if failure == "parent-deadline" {
				ctx, cancel := context.WithTimeout(req.Context(), 30*time.Millisecond)
				defer cancel()
				req = req.WithContext(ctx)
			}
			started := time.Now()
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, req)
			requireContactFailure(t, response, want)
			requireContactCount(t, store, 0)
			if time.Since(started) > 2*time.Second || attempts.Load() > 1 {
				t.Fatal("failure was not bounded or request retried")
			}
			for _, secret := range []string{"secret-token", "sensitive response", server.URL, "alex@example.com"} {
				if strings.Contains(logs.String()+response.Body.String(), secret) {
					t.Fatal("transport failure exposed private data")
				}
			}
		})
	}
}

func TestHappyContactValidationAndRateLimit(t *testing.T) {
	store, _ := newTestContactStore(t)
	var attempts atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()
	handler := testHappyContactHandler(t, store, testHappyContactClient(t, server.URL))
	for _, tc := range []struct{ field, value string }{
		{"name", ""}, {"email", "invalid"}, {"message", ""}, {"phone", strings.Repeat("1", 51)}, {"contact_guard", "filled"},
	} {
		form := validContactForm()
		form.Set(tc.field, tc.value)
		requireContactFailure(t, submitContact(handler, form, "192.0.2.1:1234"), http.StatusBadRequest)
	}
	for _, tc := range []struct {
		contentType, body string
		status            int
	}{
		{"application/json", "{}", 415},
		{"application/x-www-form-urlencoded", validContactForm().Encode() + "&extra=" + strings.Repeat("a", maxContactBody), 413},
	} {
		req := httptest.NewRequest(http.MethodPost, "/contact", strings.NewReader(tc.body))
		req.Header.Set("Content-Type", tc.contentType)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		requireContactFailure(t, response, tc.status)
	}
	if attempts.Load() != 0 {
		t.Fatal("invalid input reached HappyContact")
	}
	for range contactAttemptLimit {
		requireContactFailure(t, submitContact(handler, validContactForm(), "192.0.2.1:1234"), http.StatusServiceUnavailable)
	}
	response := submitContact(handler, validContactForm(), "192.0.2.1:5678")
	requireContactFailure(t, response, http.StatusTooManyRequests)
	if attempts.Load() != contactAttemptLimit || response.Header().Get("Retry-After") == "" {
		t.Fatal("failed attempts did not consume the existing local rate limit")
	}
	requireContactCount(t, store, 0)
}

func TestHappyContactVisitorIP(t *testing.T) {
	for _, tc := range []struct {
		name, remote, cf, real, want string
		trust, duplicate             bool
	}{
		{name: "direct-spoof", remote: "192.0.2.1:99", cf: "198.51.100.2", real: "198.51.100.3", trust: true, want: "192.0.2.1"},
		{name: "proxy-trust-disabled", remote: "127.0.0.1:99", cf: "198.51.100.2", want: "127.0.0.1"},
		{name: "trusted-proxy", remote: "127.0.0.1:99", cf: "198.51.100.2", trust: true, want: "198.51.100.2"},
		{name: "ipv6-proxy", remote: "[::1]:99", cf: "2001:db8::2", trust: true, want: "2001:db8::2"},
		{name: "mapped-proxy", remote: "[::ffff:127.0.0.1]:99", cf: "198.51.100.2", trust: true, want: "198.51.100.2"},
		{name: "invalid-cf", remote: "127.0.0.1:99", cf: "spoof", real: "198.51.100.3", trust: true, want: "127.0.0.1"},
		{name: "list-cf", remote: "127.0.0.1:99", cf: "198.51.100.2, 198.51.100.3", trust: true, want: "127.0.0.1"},
		{name: "duplicate-cf", remote: "127.0.0.1:99", cf: "198.51.100.2", duplicate: true, trust: true, want: "127.0.0.1"},
		{name: "only-x-real", remote: "127.0.0.1:99", real: "198.51.100.3", trust: true, want: "127.0.0.1"},
		{name: "invalid-remote", remote: "not-an-IP", cf: "198.51.100.2", trust: true, want: ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			forwarded := make(chan string, 1)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				forwarded <- r.Header.Get("CF-Connecting-IP")
				if r.Header.Get("X-Real-IP") != "" || r.Header.Get("X-Forwarded-For") != "" || r.Header.Get("Forwarded") != "" {
					t.Error("forwarded untrusted headers")
				}
				w.WriteHeader(http.StatusAccepted)
			}))
			defer server.Close()
			client := testHappyContactClient(t, server.URL)
			client.trustCloudflareProxy = tc.trust
			store, _ := newTestContactStore(t)
			handler := testHappyContactHandler(t, store, client)
			req := httptest.NewRequest(http.MethodPost, "/contact", strings.NewReader(validContactForm().Encode()))
			req.RemoteAddr = tc.remote
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			req.Header.Set("CF-Connecting-IP", tc.cf)
			if tc.duplicate {
				req.Header.Add("CF-Connecting-IP", "198.51.100.4")
			}
			req.Header.Set("X-Real-IP", tc.real)
			req.Header.Set("X-Forwarded-For", "198.51.100.5")
			req.Header.Set("Forwarded", "for=198.51.100.6")
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, req)
			requireContactSuccess(t, response)
			if got := <-forwarded; got != tc.want {
				t.Fatalf("forwarded IP = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestHappyContactConfiguration(t *testing.T) {
	for _, backend := range []string{"", "sqlite"} {
		t.Run("disabled-"+backend, func(t *testing.T) {
			t.Setenv("DEV_CONTACT_BACKEND", backend)
			t.Setenv("DEV_HAPPYCONTACT_BASE_URL", ":invalid-ignored")
			t.Setenv("DEV_HAPPYCONTACT_SITE_ID", "invalid-ignored")
			t.Setenv("DEV_CONTACT_TRUST_CLOUDFLARE_PROXY", "invalid-ignored")
			client, err := happyContactFromEnv()
			if err != nil || client != nil {
				t.Fatalf("disabled config = %v, %v", client, err)
			}
			store, _ := newTestContactStore(t)
			handler, err := newSiteHandler(store, nil, client)
			if err != nil {
				t.Fatal(err)
			}
			requireContactSuccess(t, submitContact(handler, validContactForm(), "192.0.2.1:99"))
			requireContactCount(t, store, 1)
		})
	}
	for _, tc := range []struct{ key, value string }{
		{"DEV_CONTACT_BACKEND", "typo"},
		{"DEV_HAPPYCONTACT_BASE_URL", ""}, {"DEV_HAPPYCONTACT_BASE_URL", "http://localhost:5290"},
		{"DEV_HAPPYCONTACT_BASE_URL", "https://example.com"}, {"DEV_HAPPYCONTACT_BASE_URL", "ftp://127.0.0.1"},
		{"DEV_HAPPYCONTACT_BASE_URL", "http://user:secret@127.0.0.1"}, {"DEV_HAPPYCONTACT_BASE_URL", "http://127.0.0.1/api"},
		{"DEV_HAPPYCONTACT_BASE_URL", "http://127.0.0.1?secret=token"}, {"DEV_HAPPYCONTACT_BASE_URL", "http://127.0.0.1#fragment"},
		{"DEV_HAPPYCONTACT_BASE_URL", "http://127.0.0.1:0"}, {"DEV_HAPPYCONTACT_BASE_URL", "http://127.0.0.1:65536"},
		{"DEV_HAPPYCONTACT_SITE_ID", ""}, {"DEV_HAPPYCONTACT_SITE_ID", "../other-site"},
		{"DEV_HAPPYCONTACT_SITE_ID", "00000000-0000-0000-0000-000000000000"},
		{"DEV_CONTACT_TRUST_CLOUDFLARE_PROXY", "maybe"},
	} {
		t.Run(tc.key+"/"+tc.value, func(t *testing.T) {
			_ = testHappyContactClient(t, "http://127.0.0.1:5290")
			t.Setenv(tc.key, tc.value)
			if client, err := happyContactFromEnv(); err == nil || client != nil {
				t.Fatal("invalid enabled configuration did not fail closed")
			} else if strings.Contains(err.Error(), "secret@") || strings.Contains(err.Error(), "secret=token") {
				t.Fatal("config error echoed sensitive configuration")
			}
		})
	}
}
