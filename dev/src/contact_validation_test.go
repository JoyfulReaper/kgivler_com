package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestContactPhoneFormats(t *testing.T) {
	// Expected formats checked against .NET 10.0.14 PhoneAttribute and
	// StringLength(40), as used by HappyContact's dev submission contract.
	for _, tc := range []struct {
		name, phone string
		valid       bool
	}{
		{"omitted", "", true},
		{"digits", "5551234567", true},
		{"international", "+44 (0)20 1234 5678", true},
		{"punctuation", "+1 (555) 123-4567", true},
		{"dots", "555.123.4567", true},
		{"ext-dot", "+44 (0)20 1234 5678 ext. 9", true},
		{"ext-case", "123 eXt45", true},
		{"ext-no-space", "123ext.45", true},
		{"x-case", "123 X 45", true},
		{"plus-anywhere", "++1+2", true},
		{"plus-in-extension", "1x+2", true},
		{"trailing-plus", "1+23 ext. 4+", true},
		{"whitespace", "123\t\n456", true},
		{"unicode-whitespace", "123\u00a0\u0085456", true},
		{"fullwidth-digits", "１２３x４５", true},
		{"arabic-digits", "١٢٣ ext. ٤٥", true},
		{"at-limit", strings.Repeat("1", 40), true},
		{"extension-at-limit", "123 ext. " + strings.Repeat("4", 31), true},
		{"unicode-at-limit", strings.Repeat("１", 40), true},
		{"over-limit", strings.Repeat("1", 41), false},
		{"unicode-over-limit", strings.Repeat("１", 41), false},
		{"plus-counts-toward-limit", "+" + strings.Repeat("1", 40), false},
		{"no-digits", "+-.()", false},
		{"letters", "call me", false},
		{"vanity-number", "1-800-FLOWERS", false},
		{"slash", "123/456", false},
		{"hash-extension", "123#45", false},
		{"missing-extension", "123ext", false},
		{"missing-extension-dot", "123ext.", false},
		{"missing-extension-x", "123x", false},
		{"missing-main-number", "ext123", false},
		{"missing-main-number-x", "x123", false},
		{"extension-internal-space", "123x4 5", false},
		{"extension-punctuation", "123x4-5", false},
		{"multiple-extensions", "1ext2x3", false},
		{"supplementary-digits", "𝟙𝟚𝟛", false},
		{"supplementary-extension", "123x𝟜", false},
		{"nondecimal-digit", "123x²", false},
		{"zero-width-space", "123\u200b456", false},
		{"invalid-utf8", "123\xff", false},
		{"unicode-case-byte-offset", strings.Repeat("Ⱥ", 9) + "ext1", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			message := contactMessage{Name: "Alex", Email: "alex@example.com", Phone: tc.phone, Message: "Hello"}
			problem := validateContact(message)
			if (problem == "") != tc.valid {
				t.Fatalf("phone %q: validation = %q, want valid=%t", tc.phone, problem, tc.valid)
			}
			if !tc.valid && (!strings.Contains(problem, "40 characters") || !strings.Contains(problem, "leave it blank")) {
				t.Fatalf("phone validation lacks useful guidance: %q", problem)
			}
		})
	}
}

func TestContactPhoneSubmissionBothBackends(t *testing.T) {
	for _, backend := range []string{"sqlite", "happycontact"} {
		t.Run(backend, func(t *testing.T) {
			for _, tc := range []struct {
				name, phone string
				include     bool
			}{
				{"omitted", "", false},
				{"blank", " \t ", true},
				{"formatted", "  +44 (0)20 1234 5678 ext. 9  ", true},
				{"unusual-but-valid", "++1+2 X ٤٥", true},
				{"at-limit", strings.Repeat("1", 40), true},
			} {
				t.Run(tc.name, func(t *testing.T) {
					store, _ := newTestContactStore(t)
					contact := &contactHandler{store: store, limiter: newContactLimiter(time.Now)}
					calls := 0
					if backend == "happycontact" {
						contact.happyContact = testHappyContactClient(t, "http://127.0.0.1:5290")
						contact.happyContact.client.Transport = contactRoundTripFunc(func(r *http.Request) (*http.Response, error) {
							calls++
							var payload map[string]string
							if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
								t.Fatal(err)
							}
							phone, present := payload["phone"]
							if phone != strings.TrimSpace(tc.phone) || present != (phone != "") {
								t.Fatalf("phone changed or empty optional field sent: %q, present=%t", phone, present)
							}
							return &http.Response{StatusCode: 202, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(""))}, nil
						})
					}
					handler := http.HandlerFunc(contact.handleContact)
					// Invalid phones and UTF-16 boundary violations must reach neither
					// backend nor the limiter, even after more than five attempts.
					for _, invalid := range []struct{ field, value string }{
						{"phone", strings.Repeat("1", 41)}, {"phone", "123x"}, {"phone", "123/456"},
						{"phone", "1-800-FLOWERS"}, {"subject", strings.Repeat("😀", 100) + "a"},
						{"email", strings.Repeat("𐐀", 154) + "a@example.com"},
					} {
						form := validContactForm()
						form.Set(invalid.field, invalid.value)
						requireContactFailure(t, submitContact(handler, form, "192.0.2.1:1234"), http.StatusBadRequest)
					}
					if calls != 0 || len(contact.limiter.clients) != 0 {
						t.Fatal("invalid input reached upstream or consumed limiter state")
					}
					requireContactCount(t, store, 0)
					form := validContactForm()
					if tc.include {
						form.Set("phone", tc.phone)
					}
					requireContactSuccess(t, submitContact(handler, form, "192.0.2.1:1234"))
					if backend == "happycontact" {
						if calls != 1 {
							t.Fatalf("upstream calls = %d, want 1", calls)
						}
						requireContactCount(t, store, 0)
					} else {
						requireContactCount(t, store, 1)
						var saved string
						if err := store.db.QueryRow("SELECT Phone FROM ContactMessages").Scan(&saved); err != nil {
							t.Fatal(err)
						}
						if saved != strings.TrimSpace(tc.phone) {
							t.Fatalf("stored phone = %q, want original formatting", saved)
						}
					}
				})
			}
		})
	}
}

func TestContactUpstreamFieldLengths(t *testing.T) {
	for _, tc := range []struct {
		field, value string
		valid        bool
	}{
		{"subject", strings.Repeat("a", 200), true},
		{"subject", strings.Repeat("😀", 100), true},
		{"subject", strings.Repeat("😀", 100) + "a", false},
		{"subject", strings.Repeat("a", 201), false},
		{"email", strings.Repeat("𐐀", 154) + "@example.com", true}, // 320 UTF-16 units, 166 runes.
		{"email", strings.Repeat("𐐀", 154) + "a@example.com", false},
		{"name", strings.Repeat("😀", 100), true},     // Already fits upstream's 200 units.
		{"message", strings.Repeat("😀", 5000), true}, // Already fits upstream's 10,000 units.
	} {
		t.Run(fmt.Sprintf("%s/%d", tc.field, len(tc.value)), func(t *testing.T) {
			form := validContactForm()
			form.Set(tc.field, tc.value)
			message := contactMessage{
				Name: strings.TrimSpace(form.Get("name")), Email: strings.TrimSpace(form.Get("email")),
				Subject: strings.TrimSpace(form.Get("subject")), Message: strings.TrimSpace(form.Get("message")),
			}
			if problem := validateContact(message); (problem == "") != tc.valid {
				t.Fatalf("validation = %q, want valid=%t", problem, tc.valid)
			}
		})
	}
}
