package main

import (
	"errors"
	"html/template"
	"log"
	"mime"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

const maxContactBody = 64 << 10

type contactHandler struct {
	store        *contactStore
	limiter      *contactLimiter
	notifier     *contactNotifier
	happyContact *happyContactClient
}

func (h *contactHandler) handleContact(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	r.Body = http.MaxBytesReader(w, r.Body, maxContactBody)
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/x-www-form-urlencoded" {
		contactError(w, http.StatusUnsupportedMediaType, "Please use the contact form to send your message.")
		return
	}
	if err := r.ParseForm(); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			contactError(w, http.StatusRequestEntityTooLarge, "Your submission is too large. Please shorten it and try again.")
		} else {
			contactError(w, http.StatusBadRequest, "The form could not be read. Please go back and try again.")
		}
		return
	}

	// Only use POST body values, never query parameters. A filled honeypot
	// must not claim the message was delivered: autofill can trip spam traps.
	if strings.TrimSpace(r.PostForm.Get("contact_guard")) != "" {
		contactError(w, http.StatusBadRequest, "Your message was not sent. Please try again without autofill, or contact me on LinkedIn.")
		return
	}
	message := contactMessage{
		Name:    strings.TrimSpace(r.PostForm.Get("name")),
		Email:   strings.TrimSpace(r.PostForm.Get("email")),
		Phone:   strings.TrimSpace(r.PostForm.Get("phone")),
		Subject: strings.TrimSpace(r.PostForm.Get("subject")),
		Message: strings.TrimSpace(r.PostForm.Get("message")),
	}
	if problem := validateContact(message); problem != "" {
		contactError(w, http.StatusBadRequest, problem)
		return
	}
	clientIP := requestRemoteHost(r)
	if h.happyContact != nil {
		clientIP = h.happyContact.visitorIP(r)
	}
	if retryAfter := h.limiter.allow(clientIP); retryAfter > 0 {
		w.Header().Set("Retry-After", strconv.Itoa(int((retryAfter+time.Second-1)/time.Second)))
		contactError(w, http.StatusTooManyRequests, "You've sent several messages recently. Please wait up to 15 minutes before trying again.")
		return
	}
	if h.happyContact != nil {
		if status := h.happyContact.submit(r.Context(), message, clientIP); status != 0 {
			problem := "Your submission could not be confirmed. Please try again later or contact me on LinkedIn."
			if status == http.StatusBadRequest {
				problem = "Your message was rejected. Please check your contact details, including the optional phone number, or contact me on LinkedIn."
			} else if status == http.StatusTooManyRequests {
				w.Header().Set("Retry-After", "60")
				problem = "The contact service is busy. Please wait at least a minute before trying again, or contact me on LinkedIn."
			}
			contactError(w, status, problem)
			return
		}
		http.Redirect(w, r, "/contact-sent.html", http.StatusSeeOther)
		return
	}
	id, err := h.store.save(r.Context(), message)
	if err != nil {
		log.Printf("contact storage failed: %v", err)
		contactError(w, http.StatusInternalServerError, "Your message could not be saved. Please try again later or contact me on LinkedIn.")
		return
	}
	h.notifier.publish(r.Context(), id, message.Name, message.Subject)
	http.Redirect(w, r, "/contact-sent.html", http.StatusSeeOther)
}

func validateContact(message contactMessage) string {
	for _, field := range []struct {
		name, value string
		max         int
		required    bool
	}{
		{"Name", message.Name, 100, true},
		{"Email", message.Email, 254, true},
		{"Subject", message.Subject, 200, false},
		{"Message", message.Message, 5000, true},
	} {
		if field.required && field.value == "" {
			return field.name + " is required. Please go back and fill it in."
		}
		if !utf8.ValidString(field.value) || utf8.RuneCountInString(field.value) > field.max {
			return field.name + " is too long or contains invalid text. Please go back and check it."
		}
	}
	if !validContactPhone(message.Phone) {
		return "Please enter a phone number of up to 40 characters, such as +1 (555) 123-4567 ext. 9, or leave it blank."
	}
	// HappyContact's .NET StringLength counts UTF-16 units. The name and
	// message rune limits already fit its 200/10,000-unit limits; these don't.
	if contactUTF16Length(message.Subject) > 200 {
		return "Subject is too long. Please use 200 characters or fewer; some symbols count as two."
	}
	if contactUTF16Length(message.Email) > 320 {
		return "Email is too long. Please use a shorter email address."
	}
	address, err := mail.ParseAddress(message.Email)
	if err != nil || address.Address != message.Email || strings.ContainsAny(message.Email, "\r\n") {
		return "Please enter a valid email address, such as name@example.com."
	}
	return ""
}

// Match HappyContact's .NET 10 PhoneAttribute and StringLength(40), allowing
// omission because the JSON client omits empty phone values. Work on a copy:
// validation must not normalize the number saved or sent upstream.
func validContactPhone(phone string) bool {
	if phone == "" {
		return true
	}
	if !utf8.ValidString(phone) || contactUTF16Length(phone) > 40 {
		return false
	}
	number := strings.TrimRightFunc(strings.ReplaceAll(phone, "+", ""), unicode.IsSpace)
	// Only these ASCII letters occur in extension markers. Preserve byte
	// offsets even for invalid Unicode input whose case mapping changes size.
	lower := strings.Map(func(r rune) rune {
		if r >= 'A' && r <= 'Z' {
			return r + ('a' - 'A')
		}
		return r
	}, number)
	for _, marker := range []string{"ext.", "ext", "x"} {
		if index := strings.LastIndex(lower, marker); index >= 0 {
			extension := strings.TrimLeftFunc(number[index+len(marker):], unicode.IsSpace)
			if extension != "" && strings.IndexFunc(extension, func(r rune) bool { return !contactPhoneDigit(r) }) < 0 {
				number = number[:index]
				break
			}
		}
	}
	digitFound := false
	for _, r := range number {
		if contactPhoneDigit(r) {
			digitFound = true
		} else if !unicode.IsSpace(r) && !strings.ContainsRune("-.()", r) {
			return false
		}
	}
	return digitFound
}

func contactPhoneDigit(r rune) bool {
	// .NET checks individual UTF-16 chars, so supplementary-plane digits
	// (surrogate pairs) do not pass char.IsDigit.
	return r <= 0xffff && unicode.IsDigit(r)
}

func contactUTF16Length(value string) int {
	length := 0
	for _, r := range value {
		length++
		if r > 0xffff {
			length++
		}
	}
	return length
}

// Only fixed application messages reach this template; form values are never echoed.
var contactErrorPage = template.Must(template.New("contact-error").Parse(`<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Contact — Kyle Givler</title>
    <link rel="stylesheet" href="/styles.css?v=3">
</head>
<body>
    <main class="container section">
        <p class="eyebrow">Contact</p>
        <h1>Message not sent</h1>
        <p>{{.}}</p>
        <p>Use your browser's Back button to edit your message.</p>
        <div class="actions">
            <a class="button secondary" href="/#contact">Return to contact form</a>
            <a class="button primary" href="https://www.linkedin.com/in/kyle-givler/">Contact me on LinkedIn</a>
        </div>
    </main>
</body>
</html>`))

func contactError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	if err := contactErrorPage.Execute(w, message); err != nil {
		log.Printf("contact error page failed: %v", err)
	}
}
