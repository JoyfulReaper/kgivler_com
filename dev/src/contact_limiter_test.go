package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func submitContact(handler http.Handler, form url.Values, client string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/contact", strings.NewReader(form.Encode()))
	req.RemoteAddr = client
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, req)
	return response
}

func TestContactRateLimit(t *testing.T) {
	store, _ := newTestContactStore(t)
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	contact := &contactHandler{store: store, limiter: newContactLimiter(func() time.Time { return now })}
	handler := http.HandlerFunc(contact.handleContact)
	for range contactAttemptLimit {
		requireContactSuccess(t, submitContact(handler, validContactForm(), "192.0.2.1:1234"))
	}
	requireContactCount(t, store, 5)
	response := submitContact(handler, validContactForm(), "192.0.2.1:5678")
	requireContactFailure(t, response, http.StatusTooManyRequests)
	if response.Header().Get("Retry-After") != "900" || !strings.Contains(response.Body.String(), "Please wait") {
		t.Fatal("rate limit response lacks retry guidance")
	}
	requireContactCount(t, store, 5)
	// Another IP has an independent budget, while changing ports does not.
	requireContactSuccess(t, submitContact(handler, validContactForm(), "192.0.2.2:1234"))
	now = now.Add(contactLimitWindow - time.Second)
	requireContactFailure(t, submitContact(handler, validContactForm(), "192.0.2.1:1234"), http.StatusTooManyRequests)
	now = now.Add(time.Second)
	requireContactSuccess(t, submitContact(handler, validContactForm(), "192.0.2.1:1234"))
	requireContactCount(t, store, 7)
}

func TestContactLimiterCleanup(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	limiter := newContactLimiter(func() time.Time { return now })
	for cycle := range 3 {
		for i := range 100 {
			limiter.allow(fmt.Sprintf("client-%d-%d", cycle, i))
		}
		if len(limiter.clients) != 100 {
			t.Fatalf("stale clients accumulated: got %d entries", len(limiter.clients))
		}
		now = now.Add(contactLimitWindow)
	}
	limiter.allow("new-client")
	if len(limiter.clients) != 1 {
		t.Fatalf("cleanup retained %d entries, want 1", len(limiter.clients))
	}
}

func TestContactLimiterConcurrentAttempts(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	limiter := newContactLimiter(func() time.Time { return now })
	var accepted atomic.Int32
	var workers sync.WaitGroup
	for range 30 {
		workers.Go(func() {
			if limiter.allow("192.0.2.1") == 0 {
				accepted.Add(1)
			}
		})
	}
	workers.Wait()
	if accepted.Load() != contactAttemptLimit {
		t.Fatalf("accepted %d concurrent attempts, want %d", accepted.Load(), contactAttemptLimit)
	}
}

func TestContactLimiterUsesRemoteHostHelper(t *testing.T) {
	store, _ := newTestContactStore(t)
	handler, err := newSiteHandler(store, nil)
	if err != nil {
		t.Fatal(err)
	}
	for i := range contactAttemptLimit + 2 {
		req := httptest.NewRequest(http.MethodPost, "/contact", strings.NewReader(validContactForm().Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.RemoteAddr = "127.0.0.1:1234"
		req.Header.Set("CF-Connecting-IP", "192.0.2.1")
		if i == contactAttemptLimit+1 {
			req.Header.Set("CF-Connecting-IP", "192.0.2.2")
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		if i == contactAttemptLimit {
			requireContactFailure(t, response, http.StatusTooManyRequests)
		} else {
			requireContactSuccess(t, response)
		}
	}
	requireContactCount(t, store, 6)
	// The contact limiter never gates the homepage, stylesheet, confirmation, or health.
	for _, path := range []string{"/", "/styles.css", "/contact-sent.html", "/health/live"} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK {
			t.Errorf("GET %s returned %d", path, response.Code)
		}
	}
}

func TestContactInvalidAndHoneypotBypassLimiter(t *testing.T) {
	store, _ := newTestContactStore(t)
	contact := &contactHandler{store: store, limiter: newContactLimiter(time.Now)}
	handler := http.HandlerFunc(contact.handleContact)
	invalid := validContactForm()
	invalid.Del("name")
	bot := validContactForm()
	bot.Set("website", "filled")
	for range contactAttemptLimit + 1 {
		requireContactFailure(t, submitContact(handler, invalid, "192.0.2.1:1234"), http.StatusBadRequest)
		requireContactSuccess(t, submitContact(handler, bot, "192.0.2.1:1234"))
	}
	if len(contact.limiter.clients) != 0 {
		t.Fatal("invalid forms or bots consumed limiter state")
	}
	for range contactAttemptLimit {
		requireContactSuccess(t, submitContact(handler, validContactForm(), "192.0.2.1:1234"))
	}
	// Their responses remain unchanged even after this client's quota is exhausted.
	requireContactFailure(t, submitContact(handler, invalid, "192.0.2.1:1234"), http.StatusBadRequest)
	requireContactSuccess(t, submitContact(handler, bot, "192.0.2.1:1234"))
	requireContactCount(t, store, 5)
}
