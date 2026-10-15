package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode"
)

type contactNotifier struct {
	url    string
	token  string
	client *http.Client
}

func newContactNotifier(publishURL, token string) *contactNotifier {
	if strings.TrimSpace(publishURL) == "" {
		return nil
	}
	return &contactNotifier{
		url: strings.TrimSpace(publishURL), token: strings.TrimSpace(token),
		client: &http.Client{
			Timeout: 2 * time.Second,
			// Do not forward credentials or contact details to a redirect target.
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
	}
}

func (n *contactNotifier) publish(ctx context.Context, id int64, name, subject string) {
	if n == nil {
		return
	}
	name = notificationLine(name)
	subject = notificationLine(subject)
	if subject == "" {
		subject = "(no subject)"
	}
	body := fmt.Sprintf("New contact #%d\nName: %s\nSubject: %s", id, name, subject)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.url, strings.NewReader(body))
	if err != nil {
		log.Print("contact notification failed: invalid publish configuration")
		return
	}
	req.Header.Set("Content-Type", "text/plain; charset=utf-8")
	req.Header.Set("Title", "New dev.kgivler.com contact")
	if n.token != "" {
		req.Header.Set("Authorization", "Bearer "+n.token)
	}
	resp, err := n.client.Do(req)
	if err != nil {
		// HTTP errors can contain the secret URL/token. Never log the error itself.
		log.Print("contact notification failed: publish request failed")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("contact notification failed: HTTP %d", resp.StatusCode)
	}
}

func notificationLine(value string) string {
	return strings.TrimSpace(strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, value))
}
