package main

import (
	"sync"
	"time"
)

const (
	contactAttemptLimit = 5
	contactLimitWindow  = 15 * time.Minute
)

type contactWindow struct {
	attempts int
	expires  time.Time
}

type contactLimiter struct {
	mu      sync.Mutex
	clients map[string]contactWindow
	now     func() time.Time
}

func newContactLimiter(now func() time.Time) *contactLimiter {
	return &contactLimiter{clients: make(map[string]contactWindow), now: now}
}

// allow counts valid submission attempts, including subsequent storage failures.
// A positive result is the time remaining before this client may try again.
func (l *contactLimiter) allow(client string) time.Duration {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	// Lazy cleanup needs no timer/goroutine and retains only active windows as
	// traffic continues. Rejected attempts do not extend a client's window.
	for key, window := range l.clients {
		if !now.Before(window.expires) {
			delete(l.clients, key)
		}
	}
	window, exists := l.clients[client]
	if !exists {
		window.expires = now.Add(contactLimitWindow)
	}
	if window.attempts >= contactAttemptLimit {
		return window.expires.Sub(now)
	}
	window.attempts++
	l.clients[client] = window
	return 0
}
