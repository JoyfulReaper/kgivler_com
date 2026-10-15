package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type contactRoundTripFunc func(*http.Request) (*http.Response, error)

func (f contactRoundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func captureContactLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	var logs bytes.Buffer
	original := log.Writer()
	log.SetOutput(&logs)
	t.Cleanup(func() { log.SetOutput(original) })
	return &logs
}

func TestContactNotificationPublishedAfterSave(t *testing.T) {
	for _, tc := range []struct {
		name, subject, token string
	}{
		{"subject-and-token", "Website help", "test-only-token"},
		{"no-subject-or-token", "", ""},
		{"untrusted-text", "Website\r\nX-Injected: yes", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store, _ := newTestContactStore(t)
			// Ensure the notified ID comes from SQLite rather than a hardcoded value.
			if _, err := store.save(context.Background(), contactMessage{Name: "Earlier", Email: "earlier@example.com", Message: "Earlier message"}); err != nil {
				t.Fatal(err)
			}
			type published struct {
				body, method string
				headers      http.Header
				stored       int
			}
			requests := make(chan published, 2)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				body, err := io.ReadAll(r.Body)
				if err != nil {
					t.Error(err)
				}
				var stored int
				if err := store.db.QueryRow("SELECT COUNT(*) FROM ContactMessages").Scan(&stored); err != nil {
					t.Error(err)
				}
				requests <- published{string(body), r.Method, r.Header.Clone(), stored}
				w.WriteHeader(http.StatusOK)
			}))
			defer server.Close()
			notifier := newContactNotifier(server.URL+"/test-topic", tc.token)
			handler, err := newSiteHandler(store, notifier)
			if err != nil {
				t.Fatal(err)
			}
			form := validContactForm()
			form.Set("name", "Alex\r\nX-Injected: yes")
			form.Set("subject", tc.subject)
			form.Set("phone", "+1 555 0100")
			response := submitContact(handler, form, "192.0.2.1:1234")
			requireContactSuccess(t, response)
			requireContactCount(t, store, 2)
			if len(requests) != 1 {
				t.Fatalf("publish requests = %d, want exactly one", len(requests))
			}
			request := <-requests
			var id int64
			if err := store.db.QueryRow("SELECT MAX(Id) FROM ContactMessages").Scan(&id); err != nil {
				t.Fatal(err)
			}
			subject := strings.ReplaceAll(tc.subject, "\r\n", "  ")
			if subject == "" {
				subject = "(no subject)"
			}
			want := fmt.Sprintf("New contact #%d\nName: Alex  X-Injected: yes\nSubject: %s", id, subject)
			if request.body != want || request.method != http.MethodPost || request.stored != 2 {
				t.Fatalf("unexpected notification: %#v; expected body %q after storage", request, want)
			}
			if request.headers.Get("Title") != "New dev.kgivler.com contact" || request.headers.Get("X-Injected") != "" || request.headers.Get("Content-Type") != "text/plain; charset=utf-8" {
				t.Fatal("unexpected notification headers")
			}
			wantAuth := ""
			if tc.token != "" {
				wantAuth = "Bearer " + tc.token
			}
			if request.headers.Get("Authorization") != wantAuth {
				t.Fatal("unexpected bearer authentication")
			}
			for _, field := range []string{"email", "phone", "message"} {
				if strings.Contains(request.body+fmt.Sprint(request.headers), strings.TrimSpace(form.Get(field))) {
					t.Errorf("notification included private %s field", field)
				}
			}
			if strings.Contains(response.Body.String(), server.URL) || strings.Contains(response.Body.String(), "test-only-token") {
				t.Fatal("contact response exposed notification configuration")
			}
		})
	}
}

func TestContactNotificationsDisabled(t *testing.T) {
	store, _ := newTestContactStore(t)
	notifier := newContactNotifier(" \t ", "unused-test-token")
	if notifier != nil {
		t.Fatal("empty URL should disable notifier")
	}
	// Any attempted HTTP publish fails this test, including accidental defaults.
	original := http.DefaultTransport
	http.DefaultTransport = contactRoundTripFunc(func(*http.Request) (*http.Response, error) {
		t.Error("disabled notifier attempted HTTP publish")
		return nil, errors.New("unexpected request")
	})
	defer func() { http.DefaultTransport = original }()
	handler, err := newSiteHandler(store, notifier)
	if err != nil {
		t.Fatal(err)
	}
	requireContactSuccess(t, submitContact(handler, validContactForm(), "192.0.2.1:1234"))
	requireContactCount(t, store, 1)
}

func TestContactNotificationHTTPFailure(t *testing.T) {
	for _, status := range []int{http.StatusServiceUnavailable, http.StatusUnauthorized, http.StatusTemporaryRedirect} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			store, _ := newTestContactStore(t)
			logs := captureContactLogs(t)
			var attempts atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				attempts.Add(1)
				w.Header().Set("Location", "/must-not-follow")
				w.WriteHeader(status)
				fmt.Fprint(w, "test-secret-response")
			}))
			defer server.Close()
			notifier := newContactNotifier(server.URL+"/test-secret-topic", "test-secret-token")
			handler, err := newSiteHandler(store, notifier)
			if err != nil {
				t.Fatal(err)
			}
			response := submitContact(handler, validContactForm(), "192.0.2.1:1234")
			requireContactSuccess(t, response)
			requireContactCount(t, store, 1)
			if attempts.Load() != 1 {
				t.Fatalf("publish attempts = %d, want 1 with no retries/redirects", attempts.Load())
			}
			if !strings.Contains(logs.String(), fmt.Sprintf("contact notification failed: HTTP %d", status)) {
				t.Fatal("missing sanitized failure log")
			}
			for _, secret := range []string{server.URL, "test-secret-topic", "test-secret-token", "test-secret-response"} {
				if strings.Contains(logs.String()+response.Body.String(), secret) {
					t.Fatal("failure exposed notification secrets")
				}
			}
		})
	}
}

func TestContactNotificationRequestFailure(t *testing.T) {
	for _, failure := range []string{"transport", "timeout", "invalid-url"} {
		t.Run(failure, func(t *testing.T) {
			store, _ := newTestContactStore(t)
			logs := captureContactLogs(t)
			notifier := newContactNotifier("http://test.invalid/test-secret-topic", "test-secret-token")
			if notifier.client.Timeout != 2*time.Second {
				t.Fatal("notification timeout is not bounded to two seconds")
			}
			attempts := 0
			notifier.client.Transport = contactRoundTripFunc(func(r *http.Request) (*http.Response, error) {
				attempts++
				if _, ok := r.Context().Deadline(); !ok {
					t.Error("HTTP client did not apply a request deadline")
				}
				if failure == "timeout" {
					return nil, context.DeadlineExceeded
				}
				return nil, errors.New("test-secret-topic test-secret-token")
			})
			wantAttempts := 1
			if failure == "invalid-url" {
				notifier.url = ":test-secret-topic"
				wantAttempts = 0
			}
			handler, err := newSiteHandler(store, notifier)
			if err != nil {
				t.Fatal(err)
			}
			response := submitContact(handler, validContactForm(), "192.0.2.1:1234")
			requireContactSuccess(t, response)
			requireContactCount(t, store, 1)
			if attempts != wantAttempts || !strings.Contains(logs.String(), "contact notification failed:") {
				t.Fatalf("attempts = %d, want %d; logs: %s", attempts, wantAttempts, logs.String())
			}
			if strings.Contains(logs.String()+response.Body.String(), "test-secret") {
				t.Fatal("request failure exposed notification secrets")
			}
		})
	}
}

func TestContactNoNotificationWithoutSave(t *testing.T) {
	for _, reason := range []string{"storage-failure", "validation", "honeypot", "rate-limit"} {
		t.Run(reason, func(t *testing.T) {
			store, path := newTestContactStore(t)
			var attempts atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				attempts.Add(1)
			}))
			defer server.Close()
			contact := &contactHandler{store: store, limiter: newContactLimiter(time.Now), notifier: newContactNotifier(server.URL, "")}
			form := validContactForm()
			status := http.StatusInternalServerError
			switch reason {
			case "storage-failure":
				if err := store.db.Close(); err != nil {
					t.Fatal(err)
				}
			case "validation":
				form.Del("name")
				status = http.StatusBadRequest
			case "honeypot":
				form = url.Values{"website": {"filled"}}
				status = http.StatusSeeOther
			case "rate-limit":
				for range contactAttemptLimit {
					contact.limiter.allow("192.0.2.1")
				}
				status = http.StatusTooManyRequests
			}
			response := submitContact(http.HandlerFunc(contact.handleContact), form, "192.0.2.1:1234")
			if status == http.StatusSeeOther {
				requireContactSuccess(t, response)
			} else {
				requireContactFailure(t, response, status)
			}
			if attempts.Load() != 0 {
				t.Fatal("notification published without a saved message")
			}
			reopened, err := openContactStore(path)
			if err != nil {
				t.Fatal(err)
			}
			defer reopened.db.Close()
			requireContactCount(t, reopened, 0)
		})
	}
}
