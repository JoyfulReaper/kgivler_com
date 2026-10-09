package main

import (
	"errors"
	"html/template"
	"log"
	"mime"
	"net/http"
	"net/mail"
	"strings"
	"unicode/utf8"
)

const maxContactBody = 64 << 10

func (s *contactStore) handleContact(w http.ResponseWriter, r *http.Request) {
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

	// Only use POST body values, never query parameters. Bots get the same PRG flow.
	if strings.TrimSpace(r.PostForm.Get("website")) != "" {
		http.Redirect(w, r, "/contact-sent.html", http.StatusSeeOther)
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
	if err := s.save(r.Context(), message); err != nil {
		log.Printf("contact storage failed: %v", err)
		contactError(w, http.StatusInternalServerError, "Your message could not be saved. Please try again later or contact me on LinkedIn.")
		return
	}
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
		{"Phone", message.Phone, 50, false},
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
	address, err := mail.ParseAddress(message.Email)
	if err != nil || address.Address != message.Email || strings.ContainsAny(message.Email, "\r\n") {
		return "Please enter a valid email address, such as name@example.com."
	}
	return ""
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
